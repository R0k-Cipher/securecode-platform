import {
  readFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

import type {
  DependencyVulnerabilityProvider,
  NormalizedDependency,
  ScanContext,
  ScannerFinding,
  ScannerResult,
  SecurityScanner,
} from '@securecode-platform/scanner-core';

import {
  NodeDependencyParser,
} from './node-dependency-parser';

export class DependencyScanner
  implements SecurityScanner
{
  readonly descriptor = {
    id:
      'dependency-scanner',

    name:
      'SecureCode Dependency Scanner',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'DEPENDENCY' as const,

    scope:
      'DEPENDENCY_GRAPH' as const,

    supportedFiles: [
      'package-lock.json',
      'package.json',
    ],
  };

  private readonly nodeParser =
    new NodeDependencyParser();

  constructor(
    private readonly vulnerabilityProvider:
      DependencyVulnerabilityProvider,
  ) {}

  supports(
    context:
      ScanContext,
  ): boolean {
    return context
      .fileInventory
      .files
      .some(
        (
          file,
        ) =>
          this.isSupportedManifest(
            file.relativePath,
          ),
      );
  }

  async scan(
    context:
      ScanContext,
  ): Promise<ScannerResult> {
    const startedAt =
      Date.now();

    const errors:
      string[] = [];

    const dependencies:
      NormalizedDependency[] = [];

    const manifests =
      this.resolveManifests(
        context,
      );

    let filesScanned =
      0;

    for (
      const manifest of
        manifests
    ) {
      try {
        const absolutePath =
          resolve(
            context.workspacePath,
            manifest,
          );

        const content =
          await readFile(
            absolutePath,
            'utf8',
          );

        if (
          manifest.endsWith(
            'package-lock.json',
          )
        ) {
          dependencies.push(
            ...this.nodeParser
              .parsePackageLock(
                content,
                manifest,
              ),
          );
        } else if (
          manifest.endsWith(
            'package.json',
          )
        ) {
          dependencies.push(
            ...this.nodeParser
              .parsePackageJson(
                content,
                manifest,
              ),
          );
        }

        filesScanned +=
          1;
      } catch (
        error: unknown
      ) {
        errors.push(
          `${manifest}: ${
            error instanceof Error
              ? error.message
              : 'Erreur inconnue'
          }`,
        );
      }
    }

    const uniqueDependencies =
      this.uniqueDependencies(
        dependencies,
      );

    const vulnerabilityMatches =
      uniqueDependencies.length >
      0
        ? await this
            .vulnerabilityProvider
            .queryMany(
              uniqueDependencies.map(
                (
                  dependency,
                ) => ({
                  dependency,
                }),
              ),
            )
        : [];

    const findings:
      ScannerFinding[] = [];

    for (
      const match of
        vulnerabilityMatches
    ) {
      for (
        const vulnerability of
          match.vulnerabilities
      ) {
        findings.push({
          ruleId:
            `DEPENDENCY-${vulnerability.id}`,

          title:
            `${match.dependency.name}@${match.dependency.version} — ${vulnerability.id}`,

          description:
            vulnerability.summary ??
            vulnerability.details ??
            `La dépendance ${match.dependency.name}@${match.dependency.version} est affectée par ${vulnerability.id}.`,

          severity:
            vulnerability.severity,

          category:
            'VULNERABLE_DEPENDENCY',

          cweId:
            undefined,

          owaspCategory:
            'A06:2021-Vulnerable and Outdated Components',

          filePath:
            match.dependency
              .manifestPath,

          recommendation:
            vulnerability
              .fixedVersions
              .length >
            0
              ? `Mettre à jour vers une version corrigée : ${vulnerability.fixedVersions.join(', ')}.`
              : 'Mettre à jour ou remplacer cette dépendance après analyse de l’avis de sécurité.',

          confidence:
            0.98,

          metadata: {
            vulnerabilityId:
              vulnerability.id,

            aliases:
              vulnerability.aliases,

            package:
              match.dependency.name,

            installedVersion:
              match.dependency.version,

            ecosystem:
              match.dependency.ecosystem,

            direct:
              match.dependency.direct,

            development:
              match.dependency.development,

            fixedVersions:
              vulnerability.fixedVersions,

            references:
              vulnerability.references,

            publishedAt:
              vulnerability.publishedAt,

            modifiedAt:
              vulnerability.modifiedAt,
          },
        });
      }
    }

    return {
      scannerId:
        this.descriptor.id,

      scannerVersion:
        this.descriptor.version,

      rulesetVersion:
        this.descriptor.rulesetVersion,

      success:
        true,

      findings,

      statistics: {
        filesConsidered:
          manifests.length,

        filesScanned,

        findingsCount:
          findings.length,

        durationMs:
          Date.now() -
          startedAt,

        skippedFiles:
          manifests.length -
          filesScanned,
      },

      errors:
        errors.slice(
          0,
          100,
        ),
    };
  }

  private resolveManifests(
    context:
      ScanContext,
  ): string[] {
    const inventoryManifests =
      context
        .fileInventory
        .files
        .filter(
          (
            file,
          ) =>
            !file.isBinary &&
            this.isSupportedManifest(
              file.relativePath,
            ),
        )
        .map(
          (
            file,
          ) =>
            file.relativePath,
        );

    /*
     * FULL :
     * tous les manifests.
     */
    if (
      context.mode ===
      'FULL'
    ) {
      return inventoryManifests;
    }

    /*
     * INCREMENTAL :
     * uniquement les manifests affectés.
     */
    const affected =
      new Set(
        context
          .dependencyFiles,
      );

    return inventoryManifests.filter(
      (
        file,
      ) =>
        affected.has(
          file,
        ),
    );
  }

  private isSupportedManifest(
    path:
      string,
  ): boolean {
    const normalized =
      path
        .replace(/\\/g, '/')

    return (
      normalized.endsWith(
        '/package-lock.json',
      ) ||
      normalized ===
        'package-lock.json' ||
      normalized.endsWith(
        '/package.json',
      ) ||
      normalized ===
        'package.json'
    );
  }

  private uniqueDependencies(
    dependencies:
      NormalizedDependency[],
  ): NormalizedDependency[] {
    const map =
      new Map<
        string,
        NormalizedDependency
      >();

    for (
      const dependency of
        dependencies
    ) {
      const key =
        [
          dependency.ecosystem,
          dependency.name,
          dependency.version,
        ].join(
          ':',
        );

      /*
       * Si la même dépendance apparaît
       * dans package.json et package-lock,
       * on privilégie package-lock.
       */
      const existing =
        map.get(
          key,
        );

      if (
        !existing ||
        dependency.manifestPath
          .endsWith(
            'package-lock.json',
          )
      ) {
        map.set(
          key,
          dependency,
        );
      }
    }

    return [
      ...map.values(),
    ];
  }
}
