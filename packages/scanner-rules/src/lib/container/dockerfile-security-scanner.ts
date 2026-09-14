import {
  readFile,
} from 'node:fs/promises';

import {
  basename,
  resolve,
} from 'node:path';

import type {
  ScanContext,
  ScannerFinding,
  ScannerResult,
  SecurityScanner,
} from '@securecode-platform/scanner-core';

export class DockerfileSecurityScanner
  implements SecurityScanner
{
  readonly descriptor = {
    id:
      'dockerfile-security',

    name:
      'SecureCode Dockerfile Scanner',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'CONTAINER' as const,

    scope:
      'FILE_LOCAL' as const,
  };

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
          this.isDockerfile(
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

    const findings:
      ScannerFinding[] = [];

    const errors:
      string[] = [];

    const files =
      this.resolveFiles(
        context,
      );

    let filesScanned =
      0;

    for (
      const file of
        files
    ) {
      try {
        const content =
          await readFile(
            resolve(
              context.workspacePath,
              file,
            ),
            'utf8',
          );

        this.analyze(
          file,
          content,
          findings,
        );

        filesScanned +=
          1;
      } catch (
        error: unknown
      ) {
        errors.push(
          `${file}: ${
            error instanceof Error
              ? error.message
              : 'Erreur'
          }`,
        );
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
        errors.length ===
        0,

      findings,

      statistics: {
        filesConsidered:
          files.length,

        filesScanned,

        findingsCount:
          findings.length,

        durationMs:
          Date.now() -
          startedAt,

        skippedFiles:
          files.length -
          filesScanned,
      },

      errors,
    };
  }

  private analyze(
    filePath:
      string,

    content:
      string,

    findings:
      ScannerFinding[],
  ): void {
    const lines =
      content.split(
        /\r?\n/,
      );

    let hasNonRootUser =
      false;

    for (
      let index = 0;
      index <
        lines.length;
      index += 1
    ) {
      const line =
        lines[index].trim();

      if (
        /^USER\s+(?!root\b|0\b).+/i.test(
          line,
        )
      ) {
        hasNonRootUser =
          true;
      }

      if (
        /^FROM\s+\S+:latest\b/i.test(
          line,
        )
      ) {
        findings.push(
          this.finding(
            'DOCKER-LATEST-TAG',
            'Image Docker utilisant le tag latest',
            'MEDIUM',
            filePath,
            index + 1,
            'Utiliser une version ou, idéalement, un digest immuable.',
          ),
        );
      }

      if (
        /^ADD\s+https?:\/\//i.test(
          line,
        )
      ) {
        findings.push(
          this.finding(
            'DOCKER-REMOTE-ADD',
            'Téléchargement distant avec ADD',
            'MEDIUM',
            filePath,
            index + 1,
            'Préférer un téléchargement contrôlé avec validation d’intégrité.',
          ),
        );
      }

      if (
        /^RUN\s+.*(?:curl|wget).*\|\s*(?:bash|sh)/i.test(
          line,
        )
      ) {
        findings.push(
          this.finding(
            'DOCKER-REMOTE-SCRIPT',
            'Script distant exécuté pendant le build',
            'HIGH',
            filePath,
            index + 1,
            'Télécharger puis vérifier le script avant son exécution.',
          ),
        );
      }

      if (
        /^EXPOSE\s+22(?:\s|$)/i.test(
          line,
        )
      ) {
        findings.push(
          this.finding(
            'DOCKER-SSH-EXPOSED',
            'Port SSH exposé par le conteneur',
            'MEDIUM',
            filePath,
            index + 1,
            'Éviter d’exécuter SSH dans un conteneur applicatif sauf nécessité justifiée.',
          ),
        );
      }
    }

    if (
      !hasNonRootUser
    ) {
      findings.push(
        this.finding(
          'DOCKER-NO-NONROOT-USER',
          'Aucun utilisateur non-root explicitement configuré',
          'HIGH',
          filePath,
          1,
          'Créer et utiliser un utilisateur applicatif non privilégié.',
        ),
      );
    }
  }

  private finding(
    ruleId:
      string,

    title:
      string,

    severity:
      'MEDIUM' |
      'HIGH',

    filePath:
      string,

    line:
      number,

    recommendation:
      string,
  ): ScannerFinding {
    return {
      ruleId,

      title,

      description:
        title,

      severity,

      category:
        'CONTAINER_SECURITY',

      owaspCategory:
        'A05:2021-Security Misconfiguration',

      filePath,

      startLine: line,

      confidence:
        0.9,

      metadata: {},
    };
  }

  private resolveFiles(
    context:
      ScanContext,
  ): string[] {
    if (
      context.mode ===
      'FULL'
    ) {
      return context
        .fileInventory
        .files
        .filter(
          (
            file,
          ) =>
            !file.isBinary &&
            this.isDockerfile(
              file.relativePath,
            ),
        )
        .map(
          (
            file,
          ) =>
            file.relativePath,
        );
    }

    return context
      .containerFiles
      .filter(
        (
          file,
        ) =>
          this.isDockerfile(
            file,
          ),
      );
  }

  private isDockerfile(
    path:
      string,
  ): boolean {
    const name =
      basename(
        path,
      ).toLowerCase();

    return (
      name ===
        'dockerfile' ||
      name.startsWith(
        'dockerfile.',
      )
    );
  }
}
