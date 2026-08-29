import {
  Injectable,
} from '@nestjs/common';

import {
  FindingSeverity,
  FindingStatus,
  Prisma,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import type {
  NormalizedFinding,
} from './finding-normalizer.service';

export interface PersistFindingsInput {
  organizationId: string;

  projectId: string;

  repositoryId: string;

  scanId: string;

  commitSha: string;

  findings:
    NormalizedFinding[];
}

export interface PersistFindingsResult {
  total: number;

  created: number;

  updated: number;

  reopened: number;
}

@Injectable()
export class FindingPersistenceService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async persist(
    input:
      PersistFindingsInput,
  ): Promise<PersistFindingsResult> {
    let created =
      0;

    let updated =
      0;

    let reopened =
      0;

    /*
     * On traite volontairement les Findings
     * de manière indépendante.
     *
     * Une transaction géante contenant des
     * milliers de findings serait mauvaise
     * pour PostgreSQL en production.
     */
    for (
      const normalized of
        input.findings
    ) {
      const result =
        await this.persistOne(
          input,
          normalized,
        );

      if (
        result ===
        'CREATED'
      ) {
        created +=
          1;
      } else if (
        result ===
        'REOPENED'
      ) {
        reopened +=
          1;
      } else {
        updated +=
          1;
      }
    }

    return {
      total:
        input.findings.length,

      created,

      updated,

      reopened,
    };
  }

  private async persistOne(
    input:
      PersistFindingsInput,

    normalized:
      NormalizedFinding,
  ): Promise<
    'CREATED' |
    'UPDATED' |
    'REOPENED'
  > {
    const existing =
      await this.prisma
        .finding
        .findUnique({
          where: {
            repositoryId_fingerprint: {
              repositoryId:
                input.repositoryId,

              fingerprint:
                normalized.fingerprint,
            },
          },

          select: {
            id:
              true,

            status:
              true,
          },
        });

    const severity =
      this.mapSeverity(
        normalized
          .finding
          .severity,
      );

    const now =
      new Date();

    if (!existing) {
      const finding =
        await this.prisma
          .finding
          .create({
            data: {
              scanId:
                input.scanId,

              projectId:
                input.projectId,

              repositoryId:
                input.repositoryId,

              ruleId:
                normalized
                  .finding
                  .ruleId,

              scanner:
                normalized
                  .scanner,

              fingerprint:
                normalized
                  .fingerprint,

              title:
                normalized
                  .finding
                  .title,

              description:
                normalized
                  .finding
                  .description,

              severity,

              status:
                FindingStatus.DETECTED,

              category:
                normalized
                  .finding
                  .category ??
                null,

              owaspCategory:
                normalized
                  .finding
                  .owaspCategory ??
                null,

              cweId:
                normalized
                  .finding
                  .cweId ??
                null,

              filePath:
                normalized
                  .finding
                  .filePath ??
                null,

              startLine:
                normalized
                  .finding
                  .startLine ??
                null,

              startColumn:
                normalized
                  .finding
                  .startColumn ??
                null,

              endLine:
                normalized
                  .finding
                  .endLine ??
                null,

              endColumn:
                normalized
                  .finding
                  .endColumn ??
                null,

              codeSnippet:
                normalized
                  .finding
                  .codeSnippet ??
                null,

              recommendation:
                normalized
                  .finding
                  .recommendation ??
                null,

              confidence:
                normalized
                  .finding
                  .confidence ??
                null,

              metadata:
                this.createMetadata(
                  normalized,
                ),

              firstDetectedAt:
                now,

              lastDetectedAt:
                now,
            },
          });

      await this.createOccurrence(
        finding.id,
        input,
        normalized,
      );

      return 'CREATED';
    }

    const shouldReopen =
      this.shouldReopen(
        existing.status,
      );

    await this.prisma
      .finding
      .update({
        where: {
          id:
            existing.id,
        },

        data: {
          /*
           * scanId représente le dernier scan
           * ayant observé ce Finding.
           */
          scanId:
            input.scanId,

          severity,

          title:
            normalized
              .finding
              .title,

          description:
            normalized
              .finding
              .description,

          category:
            normalized
              .finding
              .category ??
            null,

          owaspCategory:
            normalized
              .finding
              .owaspCategory ??
            null,

          cweId:
            normalized
              .finding
              .cweId ??
            null,

          filePath:
            normalized
              .finding
              .filePath ??
            null,

          startLine:
            normalized
              .finding
              .startLine ??
            null,

          startColumn:
            normalized
              .finding
              .startColumn ??
            null,

          endLine:
            normalized
              .finding
              .endLine ??
            null,

          endColumn:
            normalized
              .finding
              .endColumn ??
            null,

          codeSnippet:
            normalized
              .finding
              .codeSnippet ??
            null,

          recommendation:
            normalized
              .finding
              .recommendation ??
            null,

          confidence:
            normalized
              .finding
              .confidence ??
            null,

          metadata:
            this.createMetadata(
              normalized,
            ),

          lastDetectedAt:
            now,

          resolvedAt:
            shouldReopen
              ? null
              : undefined,

          status:
            shouldReopen
              ? FindingStatus.REOPENED
              : undefined,
        },
      });

    await this.createOccurrence(
      existing.id,
      input,
      normalized,
    );

    return shouldReopen
      ? 'REOPENED'
      : 'UPDATED';
  }

  private async createOccurrence(
    findingId: string,

    input:
      PersistFindingsInput,

    normalized:
      NormalizedFinding,
  ): Promise<void> {
    try {
      await this.prisma
        .findingOccurrence
        .create({
          data: {
            findingId,

            scanId:
              input.scanId,

            filePath:
              normalized
                .finding
                .filePath ??
              null,

            startLine:
              normalized
                .finding
                .startLine ??
              null,

            startColumn:
              normalized
                .finding
                .startColumn ??
              null,

            endLine:
              normalized
                .finding
                .endLine ??
              null,

            endColumn:
              normalized
                .finding
                .endColumn ??
              null,

            commitSha:
              input.commitSha,
          },
        });
    } catch (
      error: unknown
    ) {
      /*
       * Un retry BullMQ peut tenter de créer
       * la même occurrence une seconde fois.
       *
       * P2002 = unique constraint.
       */
      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code ===
          'P2002'
      ) {
        return;
      }

      throw error;
    }
  }

  private shouldReopen(
    status:
      FindingStatus,
  ): boolean {
    return (
      status ===
        FindingStatus.FIXED ||
      status ===
        FindingStatus.CLOSED
    );
  }

  private mapSeverity(
    severity:
      | 'INFO'
      | 'LOW'
      | 'MEDIUM'
      | 'HIGH'
      | 'CRITICAL',
  ): FindingSeverity {
    switch (
      severity
    ) {
      case 'CRITICAL':
        return FindingSeverity.CRITICAL;

      case 'HIGH':
        return FindingSeverity.HIGH;

      case 'MEDIUM':
        return FindingSeverity.MEDIUM;

      case 'LOW':
        return FindingSeverity.LOW;

      default:
        return FindingSeverity.INFO;
    }
  }

  private createMetadata(
    normalized:
      NormalizedFinding,
  ): Prisma.InputJsonValue {
    return {
      scannerVersion:
        normalized
          .scannerVersion,

      rulesetVersion:
        normalized
          .rulesetVersion,

      ...(normalized
        .finding
        .metadata ??
        {}),
    };
  }
}
