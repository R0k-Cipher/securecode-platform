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
} from '@securecode-platform/scanner-core';

import {
  BaseLanguageSastScanner,
} from '../language-sast-scanner';

interface PythonRule {
  id: string;

  title: string;

  severity:
    | 'LOW'
    | 'MEDIUM'
    | 'HIGH'
    | 'CRITICAL';

  category:
    string;

  cweId?:
    string;

  pattern:
    RegExp;

  recommendation:
    string;

  confidence:
    number;
}

export class PythonSastScanner
  extends BaseLanguageSastScanner
{
  readonly descriptor = {
    id:
      'python-sast',

    name:
      'SecureCode Python SAST',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'SAST' as const,

    scope:
      'FILE_LOCAL' as const,

    supportedExtensions: [
      '.py',
    ],
  };

  readonly languages =
    [
      'PYTHON',
    ] as const;

  private readonly rules:
    PythonRule[] = [
    {
      id:
        'PY-SAST-EVAL',

      title:
        'Utilisation de eval()',

      severity:
        'HIGH',

      category:
        'CODE_INJECTION',

      cweId:
        'CWE-95',

      pattern:
        /\beval\s*\(/,

      recommendation:
        'Éviter eval() avec des données non fiables et utiliser une logique explicite.',

      confidence:
        0.95,
    },

    {
      id:
        'PY-SAST-EXEC',

      title:
        'Utilisation de exec()',

      severity:
        'HIGH',

      category:
        'CODE_INJECTION',

      cweId:
        'CWE-95',

      pattern:
        /\bexec\s*\(/,

      recommendation:
        'Éviter exec() sur des données contrôlables par un utilisateur.',

      confidence:
        0.95,
    },

    {
      id:
        'PY-SAST-SUBPROCESS-SHELL',

      title:
        'Commande subprocess avec shell=True',

      severity:
        'CRITICAL',

      category:
        'COMMAND_INJECTION',

      cweId:
        'CWE-78',

      pattern:
        /\bsubprocess\.(?:run|call|Popen|check_output|check_call)\s*\([^)]*shell\s*=\s*True/i,

      recommendation:
        'Éviter shell=True et passer les arguments sous forme de liste strictement validée.',

      confidence:
        0.92,
    },

    {
      id:
        'PY-SAST-OS-SYSTEM',

      title:
        'Utilisation de os.system()',

      severity:
        'HIGH',

      category:
        'COMMAND_INJECTION',

      cweId:
        'CWE-78',

      pattern:
        /\bos\.system\s*\(/,

      recommendation:
        'Préférer subprocess avec shell=False et des arguments séparés.',

      confidence:
        0.9,
    },

    {
      id:
        'PY-SAST-PICKLE-LOAD',

      title:
        'Désérialisation Pickle potentiellement dangereuse',

      severity:
        'HIGH',

      category:
        'UNSAFE_DESERIALIZATION',

      cweId:
        'CWE-502',

      pattern:
        /\bpickle\.(?:load|loads)\s*\(/,

      recommendation:
        'Ne jamais désérialiser avec pickle des données provenant d’une source non fiable.',

      confidence:
        0.9,
    },

    {
      id:
        'PY-SAST-YAML-UNSAFE-LOAD',

      title:
        'Chargement YAML potentiellement dangereux',

      severity:
        'HIGH',

      category:
        'UNSAFE_DESERIALIZATION',

      cweId:
        'CWE-502',

      pattern:
        /\byaml\.load\s*\(/,

      recommendation:
        'Utiliser yaml.safe_load() pour les données non fiables.',

      confidence:
        0.85,
    },

    {
      id:
        'PY-SAST-REQUESTS-VERIFY-FALSE',

      title:
        'Validation TLS désactivée',

      severity:
        'HIGH',

      category:
        'TLS_CONFIGURATION',

      cweId:
        'CWE-295',

      pattern:
        /\brequests\.(?:get|post|put|patch|delete|request)\s*\([^)]*verify\s*=\s*False/i,

      recommendation:
        'Conserver la vérification TLS activée.',

      confidence:
        0.95,
    },
  ];

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
      context
        .affectedFiles
        .filter(
          (path) => {
            const inventory =
              context
                .fileInventory
                .files
                .find(
                  (file) =>
                    file.relativePath ===
                    path,
                );

            return (
              inventory
                ?.language ===
              'PYTHON'
            );
          },
        );

    let scanned =
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

          if (
            line
              .trim()
              .startsWith(
                '#',
              )
          ) {
            continue;
          }

          for (
            const rule of
              this.rules
          ) {
            rule.pattern.lastIndex =
              0;

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
                rule.title,

              severity:
                rule.severity,

              category:
                rule.category,

              cweId:
                rule.cweId,

              filePath:
                file,

              startLine:
                index + 1,

              recommendation:
                rule.recommendation,

              confidence:
                rule.confidence,

              metadata: {
                language:
                  'PYTHON',
              },
            });
          }
        }

        scanned +=
          1;
      } catch (
        error: unknown
      ) {
        errors.push(
          `${file}: ${
            error instanceof Error
              ? error.message
              : 'Erreur Python scanner'
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

        filesScanned:
          scanned,

        findingsCount:
          findings.length,

        durationMs:
          Date.now() -
          startedAt,

        skippedFiles:
          files.length -
          scanned,
      },

      errors:
        errors.slice(
          0,
          100,
        ),
    };
  }
}
