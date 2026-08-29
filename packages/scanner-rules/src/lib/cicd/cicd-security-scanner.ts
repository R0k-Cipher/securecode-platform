import {
  readFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

import type {
  ScanContext,
  ScannerFinding,
  ScannerResult,
  SecurityScanner,
} from '@securecode-platform/scanner-core';

export class CiCdSecurityScanner
  implements SecurityScanner
{
  readonly descriptor = {
    id:
      'cicd-security',

    name:
      'SecureCode CI/CD Scanner',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'CI_CD' as const,

    scope:
      'FILE_LOCAL' as const,

    supportedExtensions: [
      '.yml',
      '.yaml',
    ],
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
          this.isCiCdFile(
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
      const relativePath of
        files
    ) {
      try {
        const content =
          await readFile(
            resolve(
              context.workspacePath,
              relativePath,
            ),
            'utf8',
          );

        this.analyze(
          relativePath,
          content,
          findings,
        );

        filesScanned +=
          1;
      } catch (
        error: unknown
      ) {
        errors.push(
          `${relativePath}: ${
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

    for (
      let index = 0;
      index <
        lines.length;
      index += 1
    ) {
      const line =
        lines[index];

      /*
       * GitHub Actions avec permissions
       * potentiellement excessives.
       */
      if (
        /\bpermissions\s*:\s*write-all\b/i.test(
          line,
        )
      ) {
        findings.push(
          this.createFinding(
            'CICD-WRITE-ALL',
            'Permissions GitHub Actions excessives',
            'HIGH',
            filePath,
            index + 1,
            'Éviter permissions: write-all et appliquer le principe du moindre privilège.',
          ),
        );
      }

      /*
       * Utilisation d'une action sur une branche
       * mutable au lieu d'un commit SHA.
       */
      const usesMatch =
        line.match(
          /\buses\s*:\s*([^\s#]+)@([^\s#]+)/i,
        );

      if (
        usesMatch &&
        !/^[a-f0-9]{40}$/i.test(
          usesMatch[2],
        ) &&
        !usesMatch[1]
          .startsWith(
            './',
          )
      ) {
        findings.push(
          this.createFinding(
            'CICD-UNPINNED-ACTION',
            'Action CI/CD non verrouillée sur un commit',
            'MEDIUM',
            filePath,
            index + 1,
            'Pour les workflows sensibles, verrouiller les actions tierces sur un SHA de commit approuvé.',
          ),
        );
      }

      if (
        /\bcurl\b.+\|\s*(?:bash|sh)\b/i.test(
          line,
        ) ||
        /\bwget\b.+\|\s*(?:bash|sh)\b/i.test(
          line,
        )
      ) {
        findings.push(
          this.createFinding(
            'CICD-REMOTE-SCRIPT-EXECUTION',
            'Exécution directe d’un script distant',
            'HIGH',
            filePath,
            index + 1,
            'Télécharger, vérifier et valider le script avant son exécution.',
          ),
        );
      }
    }

    /*
     * Permissions absentes sur GitHub Actions.
     * Ce n'est pas systématiquement vulnérable,
     * donc sévérité faible.
     */
    if (
      filePath
        .replace(/\\/g, '/')
        .includes(
          '.github/workflows/',
        ) &&
      !/^\s*permissions\s*:/m.test(
        content,
      )
    ) {
      findings.push(
        this.createFinding(
          'CICD-PERMISSIONS-NOT-EXPLICIT',
          'Permissions GitHub Actions non explicites',
          'LOW',
          filePath,
          1,
          'Déclarer explicitement les permissions nécessaires au workflow.',
        ),
      );
    }
  }

  private createFinding(
    ruleId:
      string,

    title:
      string,

    severity:
      'LOW' |
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
        'CI_CD_SECURITY',

      owaspCategory:
        'A05:2021-Security Misconfiguration',

      filePath,

      startLine: line,

      recommendation,

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
            this.isCiCdFile(
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
      .ciCdFiles
      .filter(
        (
          file,
        ) =>
          this.isCiCdFile(
            file,
          ),
      );
  }

  private isCiCdFile(
    path:
      string,
  ): boolean {
    const normalized =
      path
        .replace(/\\/g, '/')
        .toLowerCase();

    return (
      normalized.includes(
        '.github/workflows/',
      ) ||
      normalized.endsWith(
        '.gitlab-ci.yml',
      ) ||
      normalized.endsWith(
        'azure-pipelines.yml',
      )
    );
  }
}
