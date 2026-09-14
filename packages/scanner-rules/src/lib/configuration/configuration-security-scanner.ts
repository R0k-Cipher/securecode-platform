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

interface ConfigurationRule {
  id: string;

  title: string;

  severity:
    | 'INFO'
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';

  category: string;

  pattern: RegExp;

  recommendation: string;

  filePatterns?: RegExp[];
}

export class ConfigurationSecurityScanner
  implements SecurityScanner
{
  readonly descriptor = {
    id:
      'configuration-security',

    name:
      'SecureCode Configuration Scanner',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'CONFIGURATION' as const,

    scope:
      'FILE_LOCAL' as const,

    supportedExtensions: [
      '.env',
      '.ini',
      '.conf',
      '.config',
      '.yaml',
      '.yml',
      '.json',
      '.toml',
      '.properties',
    ],
  };

  private readonly rules:
    ConfigurationRule[] = [
    {
      id:
        'CONFIG-DEBUG-ENABLED',

      title:
        'Mode debug activé',

      severity:
        'MEDIUM',

      category:
        'SECURITY_MISCONFIGURATION',

      pattern:
        /\b(?:debug|app_debug)\s*[:=]\s*(?:true|1|yes|on)\b/i,

      recommendation:
        'Désactiver le mode debug dans les environnements de production.',
    },

    {
      id:
        'CONFIG-TLS-VERIFY-DISABLED',

      title:
        'Vérification TLS désactivée',

      severity:
        'HIGH',

      category:
        'INSECURE_TRANSPORT',

      pattern:
        /\b(?:verify_ssl|ssl_verify|tls_verify|rejectUnauthorized)\s*[:=]\s*(?:false|0|no|off)\b/i,

      recommendation:
        'Activer la vérification des certificats TLS.',
    },

    {
      id:
        'CONFIG-CORS-WILDCARD',

      title:
        'Politique CORS potentiellement trop permissive',

      severity:
        'MEDIUM',

      category:
        'SECURITY_MISCONFIGURATION',

      pattern:
        /(?:allowed[_-]?origins?|cors[_-]?origin)\s*[:=]\s*["']?\*["']?/i,

      recommendation:
        'Limiter les origines CORS aux domaines explicitement autorisés.',
    },

    {
      id:
        'CONFIG-HOST-WILDCARD',

      title:
        'Écoute réseau sur toutes les interfaces',

      severity:
        'LOW',

      category:
        'NETWORK_EXPOSURE',

      pattern:
        /\b(?:host|bind|listen_address)\s*[:=]\s*["']?0\.0\.0\.0["']?/i,

      recommendation:
        'Vérifier que l’exposition sur toutes les interfaces réseau est nécessaire.',
    },

    {
      id:
        'CONFIG-INSECURE-HTTP',

      title:
        'Endpoint HTTP non chiffré',

      severity:
        'LOW',

      category:
        'INSECURE_TRANSPORT',

      pattern:
        /\bhttp:\/\/[a-z0-9.-]+(?::\d+)?/i,

      recommendation:
        'Utiliser HTTPS lorsque le service supporte TLS.',
    },
  ];

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
          this.isConfigurationFile(
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

    let filesScanned =
      0;

    const candidates =
      this.resolveFiles(
        context,
      );

    for (
      const relativePath of
        candidates
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
           * Éviter les commentaires simples.
           */
          const trimmed =
            line.trim();

          if (
            trimmed.startsWith('#') ||
            trimmed.startsWith('//')
          ) {
            continue;
          }

          for (
            const rule of
              this.rules
          ) {
            if (
              !rule.pattern.test(
                line,
              )
            ) {
              continue;
            }

            findings.push({
              ruleId:
                rule.id,

              title:
                rule.title,

              description:
                `Configuration potentiellement dangereuse détectée dans ${relativePath}.`,

              severity:
                rule.severity,

              category:
                rule.category,

              owaspCategory:
                'A05:2021-Security Misconfiguration',

              filePath:
                relativePath,

              startLine:
                index + 1,

              recommendation:
                rule.recommendation,

              confidence:
                0.8,

              metadata: {
                scanner:
                  'configuration',
              },
            });
          }
        }

        filesScanned +=
          1;
      } catch (
        error: unknown
      ) {
        errors.push(
          `${relativePath}: ${
            error instanceof Error
              ? error.message
              : 'Erreur de lecture'
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

        filesScanned,

        findingsCount:
          findings.length,

        durationMs:
          Date.now() -
          startedAt,

        skippedFiles:
          candidates.length -
          filesScanned,
      },

      errors:
        errors.slice(
          0,
          100,
        ),
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
            this.isConfigurationFile(
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
          this.isConfigurationFile(
            file,
          ),
      );
  }

  private isConfigurationFile(
    path:
      string,
  ): boolean {
    const normalized =
      path
        .replace(/\\/g, '/')
        .toLowerCase();

    return (
      normalized.endsWith(
        '.env',
      ) ||
      normalized.includes(
        '.env.',
      ) ||
      normalized.endsWith(
        '.ini',
      ) ||
      normalized.endsWith(
        '.conf',
      ) ||
      normalized.endsWith(
        '.config',
      ) ||
      normalized.endsWith(
        '.yaml',
      ) ||
      normalized.endsWith(
        '.yml',
      ) ||
      normalized.endsWith(
        '.toml',
      ) ||
      normalized.endsWith(
        '.properties',
      )
    );
  }
}
