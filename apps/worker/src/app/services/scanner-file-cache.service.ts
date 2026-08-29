import {
  Injectable,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  Prisma,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import type {
  ScannerFinding,
  SecurityScanner,
} from '@securecode-platform/scanner-core';

export interface ScannerFileCacheLookup {
  organizationId: string;

  repositoryId: string;

  fileHash: string;

  relativePath: string;

  scanner: SecurityScanner;
}

export interface ScannerFileCacheWrite
  extends ScannerFileCacheLookup {
  findings: ScannerFinding[];
}

@Injectable()
export class ScannerFileCacheService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly configService:
      ConfigService,
  ) {}

  async get(
    input:
      ScannerFileCacheLookup,
  ): Promise<
    ScannerFinding[] |
    null
  > {
    const descriptor =
      input.scanner.descriptor;

    const cache =
      await this.prisma
        .scannerFileCache
        .findUnique({
          where: {
            scanner_file_cache_key: {
              organizationId:
                input.organizationId,

              repositoryId:
                input.repositoryId,

              fileHash:
                input.fileHash,

              scannerId:
                descriptor.id,

              scannerVersion:
                descriptor.version,

              rulesetVersion:
                descriptor.rulesetVersion,
            },
          },

          select: {
            id:
              true,

            findings:
              true,

            expiresAt:
              true,
          },
        });

    if (!cache) {
      return null;
    }

    if (
      cache.expiresAt &&
      cache.expiresAt.getTime() <=
        Date.now()
    ) {
      await this.prisma
        .scannerFileCache
        .delete({
          where: {
            id:
              cache.id,
          },
        });

      return null;
    }

    const findings =
      this.deserializeFindings(
        cache.findings,
        input.relativePath,
      );

    /*
     * Mise à jour de lastUsedAt.
     *
     * Nous l'attendons pour garder un état
     * cohérent. Une optimisation batch pourra
     * être ajoutée ultérieurement.
     */
    await this.prisma
      .scannerFileCache
      .update({
        where: {
          id:
            cache.id,
        },

        data: {
          lastUsedAt:
            new Date(),
        },
      });

    return findings;
  }

  async put(
    input:
      ScannerFileCacheWrite,
  ): Promise<void> {
    const descriptor =
      input.scanner.descriptor;

    const expiresAt =
      this.calculateExpiration();

    const findings =
      this.serializeFindings(
        input.findings,
      );

    await this.prisma
      .scannerFileCache
      .upsert({
        where: {
          scanner_file_cache_key: {
            organizationId:
              input.organizationId,

            repositoryId:
              input.repositoryId,

            fileHash:
              input.fileHash,

            scannerId:
              descriptor.id,

            scannerVersion:
              descriptor.version,

            rulesetVersion:
              descriptor.rulesetVersion,
          },
        },

        create: {
          organizationId:
            input.organizationId,

          repositoryId:
            input.repositoryId,

          fileHash:
            input.fileHash,

          scannerId:
            descriptor.id,

          scannerVersion:
            descriptor.version,

          rulesetVersion:
            descriptor.rulesetVersion,

          findings,

          expiresAt,

          lastUsedAt:
            new Date(),
        },

        update: {
          findings,

          expiresAt,

          lastUsedAt:
            new Date(),
        },
      });
  }

  async pruneExpired():
    Promise<number> {
    const result =
      await this.prisma
        .scannerFileCache
        .deleteMany({
          where: {
            expiresAt: {
              lte:
                new Date(),
            },
          },
        });

    return result.count;
  }

  private serializeFindings(
    findings:
      ScannerFinding[],
  ): Prisma.InputJsonValue {
    /*
     * Le path ne fait pas partie du résultat
     * réutilisable.
     *
     * Même contenu renommé :
     * nous réutilisons la détection et appliquons
     * le nouveau path lors du cache HIT.
     */
    const withoutPaths =
      findings.map(
        (
          finding,
        ) => {
          const {
            filePath:
              _filePath,

            ...cacheableFinding
          } = finding;

          return cacheableFinding;
        },
      );

    /*
     * Supprime aussi les éventuelles valeurs
     * undefined incompatibles avec Prisma Json.
     */
    return JSON.parse(
      JSON.stringify(
        withoutPaths,
      ),
    ) as Prisma.InputJsonValue;
  }

  private deserializeFindings(
    value:
      Prisma.JsonValue,

    relativePath:
      string,
  ): ScannerFinding[] {
    if (
      !Array.isArray(
        value,
      )
    ) {
      return [];
    }

    const findings:
      ScannerFinding[] = [];

    for (
      const item of
        value
    ) {
      if (
        !item ||
        typeof item !==
          'object' ||
        Array.isArray(
          item,
        )
      ) {
        continue;
      }

      const candidate =
        item as Record<
          string,
          unknown
        >;

      if (
        typeof candidate.ruleId !==
          'string' ||
        typeof candidate.title !==
          'string' ||
        typeof candidate.description !==
          'string' ||
        typeof candidate.severity !==
          'string'
      ) {
        continue;
      }

      const severity =
        candidate.severity;

      if (
        severity !== 'INFO' &&
        severity !== 'LOW' &&
        severity !== 'MEDIUM' &&
        severity !== 'HIGH' &&
        severity !== 'CRITICAL'
      ) {
        continue;
      }

      findings.push({
        ...candidate,

        ruleId:
          candidate.ruleId,

        title:
          candidate.title,

        description:
          candidate.description,

        severity,

        filePath:
          relativePath,
      } as ScannerFinding);
    }

    return findings;
  }

  private calculateExpiration():
    Date {
    const days =
      this.getTtlDays();

    return new Date(
      Date.now() +
        days *
          24 *
          60 *
          60 *
          1000,
    );
  }

  private getTtlDays():
    number {
    const configured =
      Number(
        this.configService
          .get<string>(
            'SCANNER_FILE_CACHE_TTL_DAYS',
          ) ??
          30,
      );

    if (
      !Number.isFinite(
        configured,
      ) ||
      configured <= 0
    ) {
      return 30;
    }

    return Math.min(
      Math.floor(
        configured,
      ),
      365,
    );
  }
}
