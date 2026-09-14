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

export class KubernetesSecurityScanner
  implements SecurityScanner
{
  readonly descriptor = {
    id:
      'kubernetes-security',

    name:
      'SecureCode Kubernetes Scanner',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'CONFIGURATION' as const,

    scope:
      'FILE_LOCAL' as const,

    supportedExtensions: [
      '.yaml',
      '.yml',
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
          this.isKubernetesCandidate(
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

    const candidates =
      this.resolveFiles(
        context,
      );

    let scanned =
      0;

    for (
      const file of
        candidates
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

        /*
         * Évite d'analyser tous les YAML
         * arbitraires comme Kubernetes.
         */
        if (
          !/\bapiVersion\s*:/m.test(
            content,
          ) ||
          !/\bkind\s*:/m.test(
            content,
          )
        ) {
          continue;
        }

        this.analyze(
          file,
          content,
          findings,
        );

        scanned +=
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
          candidates.length,

        filesScanned:
          scanned,

        findingsCount:
          findings.length,

        durationMs:
          Date.now() -
          startedAt,

        skippedFiles:
          candidates.length -
          scanned,
      },

      errors,
    };
  }

  private analyze(
    file:
      string,

    content:
      string,

    findings:
      ScannerFinding[],
  ): void {
    const checks = [
      {
        id:
          'K8S-PRIVILEGED',

        regex:
          /\bprivileged\s*:\s*true\b/i,

        title:
          'Conteneur Kubernetes privilégié',

        severity:
          'CRITICAL' as const,

        recommendation:
          'Désactiver privileged sauf nécessité exceptionnelle et documentée.',
      },

      {
        id:
          'K8S-HOST-NETWORK',

        regex:
          /\bhostNetwork\s*:\s*true\b/i,

        title:
          'Utilisation du réseau de l’hôte',

        severity:
          'HIGH' as const,

        recommendation:
          'Éviter hostNetwork et utiliser le réseau Kubernetes.',
      },

      {
        id:
          'K8S-HOST-PID',

        regex:
          /\bhostPID\s*:\s*true\b/i,

        title:
          'Partage de l’espace PID de l’hôte',

        severity:
          'HIGH' as const,

        recommendation:
          'Désactiver hostPID sauf besoin explicitement justifié.',
      },

      {
        id:
          'K8S-ALLOW-PRIVILEGE-ESCALATION',

        regex:
          /\ballowPrivilegeEscalation\s*:\s*true\b/i,

        title:
          'Élévation de privilèges autorisée',

        severity:
          'HIGH' as const,

        recommendation:
          'Définir allowPrivilegeEscalation: false.',
      },

      {
        id:
          'K8S-RUN-AS-ROOT',

        regex:
          /\brunAsUser\s*:\s*0\b/i,

        title:
          'Conteneur exécuté avec UID root',

        severity:
          'HIGH' as const,

        recommendation:
          'Utiliser un UID non privilégié.',
      },
    ];

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
      for (
        const check of
          checks
      ) {
        if (
          !check.regex.test(
            lines[index],
          )
        ) {
          continue;
        }

        findings.push({
          ruleId:
            check.id,

          title:
            check.title,

          description:
            check.title,

          severity:
            check.severity,

          category:
            'KUBERNETES_SECURITY',

          owaspCategory:
            'A05:2021-Security Misconfiguration',

          filePath:
            file,

          startLine:
            index + 1,

          recommendation:
            check.recommendation,

          confidence:
            0.95,

          metadata: {},
        });
      }
    }
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
            this.isKubernetesCandidate(
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
      .configurationFiles
      .filter(
        (
          file,
        ) =>
          this.isKubernetesCandidate(
            file,
          ),
      );
  }

  private isKubernetesCandidate(
    path:
      string,
  ): boolean {
    const normalized =
      path
        .replace(/\\/g, '/')
        .toLowerCase();

    return (
      normalized.endsWith(
        '.yaml',
      ) ||
      normalized.endsWith(
        '.yml',
      )
    );
  }
}
