import {
  Injectable,
} from '@nestjs/common';

import {
  ScannerRegistry,
} from '@securecode-platform/scanner-core';

import type {
  ScanContext,
  ScannerKind,
  ScannerResult,
  SecurityScanner,
} from '@securecode-platform/scanner-core';

import {
  DependencyScanner,
  JavaScriptTypeScriptSastScanner,
  SecretScanner,
  CiCdSecurityScanner,
  ConfigurationSecurityScanner,
  DockerfileSecurityScanner,
  KubernetesSecurityScanner,

} from '@securecode-platform/scanner-rules';

import {
  OsvVulnerabilityProviderService,
} from './osv-vulnerability-provider.service';

import {
  ScannerFileCacheService,
} from './scanner-file-cache.service';

import {
  JavaSastScanner,
  PhpSastScanner,
  PythonSastScanner,
} from '@securecode-platform/scanner-rules';

@Injectable()
export class ScannerRuntimeService {
  private readonly registry:
    ScannerRegistry;

  constructor(
    private readonly osvProvider:
      OsvVulnerabilityProviderService,

    private readonly fileCache:
      ScannerFileCacheService,
  ) {
    this.registry =
      new ScannerRegistry();

    this.registry.registerMany([
      new SecretScanner(),

      new JavaScriptTypeScriptSastScanner(),

      new DependencyScanner( this.osvProvider),

      new CiCdSecurityScanner(),

      new ConfigurationSecurityScanner(),

      new DockerfileSecurityScanner(),

      new KubernetesSecurityScanner(),

      new JavaSastScanner(),
      
      new PhpSastScanner(),

      new PythonSastScanner(),
    ]);
  }

  async execute(
    context:
      ScanContext,

    requestedKinds:
      ScannerKind[],
  ): Promise<
    ScannerResult[]
  > {
    const scanners =
      this.registry
        .findCompatible(
          context,
          requestedKinds,
        );

    /*
     * Nous conservons une parallélisation
     * contrôlée entre scanners.
     */
    const results =
      await Promise.all(
        scanners.map(
          (
            scanner,
          ) =>
            scanner.descriptor
              .scope ===
            'FILE_LOCAL'
              ? this.executeFileLocalScanner(
                  scanner,
                  context,
                )
              : this.executeScannerSafely(
                  scanner,
                  context,
                ),
        ),
      );

    return results;
  }

  private async executeFileLocalScanner(
    scanner:
      SecurityScanner,

    context:
      ScanContext,
  ): Promise<ScannerResult> {
    const startedAt =
      Date.now();

    const findings:
      ScannerResult['findings'] =
      [];

    const errors:
      string[] =
      [];

    let filesScanned =
      0;

    let skippedFiles =
      0;

    let cacheHits =
      0;

    let cacheMisses =
      0;

    const inventoryByPath =
      new Map(
        context
          .fileInventory
          .files
          .map(
            (
              file,
            ) => [
              file.relativePath,
              file,
            ],
          ),
      );

    const candidateFiles =
      context
        .affectedFiles
        .filter(
          (
            relativePath,
          ) => {
            const file =
              inventoryByPath.get(
                relativePath,
              );

            if (
              !file ||
              file.isBinary
            ) {
              return false;
            }

            const extensions =
              scanner
                .descriptor
                .supportedExtensions;

            if (
              extensions &&
              extensions.length >
                0 &&
              !extensions.includes(
                file.extension,
              )
            ) {
              return false;
            }

            return true;
          },
        );

    for (
      const relativePath of
        candidateFiles
    ) {
      const inventoryEntry =
        inventoryByPath.get(
          relativePath,
        );

      if (!inventoryEntry) {
        skippedFiles +=
          1;

        continue;
      }

      const cached =
        await this.fileCache.get({
          organizationId:
            context.organizationId,

          repositoryId:
            context.repositoryId,

          fileHash:
            inventoryEntry.sha256,

          relativePath,

          scanner,
        });

      if (cached) {
        findings.push(
          ...cached,
        );

        cacheHits +=
          1;

        continue;
      }

      cacheMisses +=
        1;

      /*
       * Le scanner ne voit qu'un fichier.
       *
       * SecretScanner et JS/TS SAST sont
       * FILE_LOCAL et peuvent donc être
       * exécutés indépendamment.
       */
      const fileContext:
        ScanContext = {
        ...context,

        affectedFiles: [
          relativePath,
        ],

        sourceFiles:
          context.sourceFiles.includes(
            relativePath,
          )
            ? [
                relativePath,
              ]
            : [],

        dependencyFiles:
          [],

        configurationFiles:
          context.configurationFiles.includes(
            relativePath,
          )
            ? [
                relativePath,
              ]
            : [],

        containerFiles:
          context.containerFiles.includes(
            relativePath,
          )
            ? [
                relativePath,
              ]
            : [],

        ciCdFiles:
          context.ciCdFiles.includes(
            relativePath,
          )
            ? [
                relativePath,
              ]
            : [],
      };

      try {
        const result =
          await scanner.scan(
            fileContext,
          );

        findings.push(
          ...result.findings,
        );

        filesScanned +=
          result.statistics
            .filesScanned;

        skippedFiles +=
          result.statistics
            .skippedFiles;

        errors.push(
          ...result.errors,
        );

        if (
          result.success
        ) {
          await this.fileCache.put({
            organizationId:
              context.organizationId,

            repositoryId:
              context.repositoryId,

            fileHash:
              inventoryEntry.sha256,

            relativePath,

            scanner,

            findings:
              result.findings,
          });
        }
      } catch (
        error: unknown
      ) {
        errors.push(
          `${relativePath}: ${
            error instanceof Error
              ? error.message
              : 'Erreur scanner inconnue.'
          }`,
        );
      }
    }

    return {
      scannerId:
        scanner.descriptor.id,

      scannerVersion:
        scanner.descriptor.version,

      rulesetVersion:
        scanner.descriptor.rulesetVersion,

      success:
        true,

      findings,

      statistics: {
        filesConsidered:
          candidateFiles.length,

        filesScanned,

        findingsCount:
          findings.length,

        durationMs:
          Date.now() -
          startedAt,

        skippedFiles,

        cacheHits,

        cacheMisses,
      },

      errors:
        errors.slice(
          0,
          100,
        ),
    };
  }

  private async executeScannerSafely(
    scanner:
      SecurityScanner,

    context:
      ScanContext,
  ): Promise<ScannerResult> {
    try {
      return await scanner.scan(
        context,
      );
    } catch (
      error: unknown
    ) {
      return {
        scannerId:
          scanner.descriptor.id,

        scannerVersion:
          scanner.descriptor.version,

        rulesetVersion:
          scanner.descriptor.rulesetVersion,

        success:
          false,

        findings:
          [],

        statistics: {
          filesConsidered:
            0,

          filesScanned:
            0,

          findingsCount:
            0,

          durationMs:
            0,

          skippedFiles:
            0,

          cacheHits:
            0,

          cacheMisses:
            0,
        },

        errors: [
          error instanceof Error
            ? error.message
            : 'Erreur scanner inconnue.',
        ],
      };
    }
  }
}
