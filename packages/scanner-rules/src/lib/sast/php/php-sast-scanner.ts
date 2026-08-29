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

export class PhpSastScanner
  extends BaseLanguageSastScanner
{
  readonly descriptor = {
    id:
      'php-sast',

    name:
      'SecureCode PHP SAST',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'SAST' as const,

    scope:
      'FILE_LOCAL' as const,

    supportedExtensions: [
      '.php',
    ],
  };

  readonly languages =
    [
      'PHP',
    ] as const;

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
          (path) =>
            context
              .fileInventory
              .files
              .some(
                (file) =>
                  file.relativePath ===
                    path &&
                  file.language ===
                    'PHP',
              ),
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

          this.applyRules(
            file,
            line,
            index + 1,
            findings,
          );
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
              : 'Erreur PHP scanner'
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

      errors,
    };
  }

  private applyRules(
    file:
      string,

    line:
      string,

    lineNumber:
      number,

    findings:
      ScannerFinding[],
  ): void {
    const checks = [
      {
        regex:
          /\beval\s*\(/i,

        id:
          'PHP-EVAL',

        title:
          'Utilisation de eval()',

        severity:
          'HIGH' as const,

        category:
          'CODE_INJECTION',

        cwe:
          'CWE-95',
      },

      {
        regex:
          /\b(?:exec|system|shell_exec|passthru|popen|proc_open)\s*\(/i,

        id:
          'PHP-COMMAND-EXECUTION',

        title:
          'Exécution de commande système',

        severity:
          'HIGH' as const,

        category:
          'COMMAND_INJECTION',

        cwe:
          'CWE-78',
      },

      {
        regex:
          /\bunserialize\s*\(/i,

        id:
          'PHP-UNSERIALIZE',

        title:
          'Utilisation de unserialize()',

        severity:
          'HIGH' as const,

        category:
          'UNSAFE_DESERIALIZATION',

        cwe:
          'CWE-502',
      },

      {
        regex:
          /\bmd5\s*\(/i,

        id:
          'PHP-MD5',

        title:
          'Utilisation de MD5',

        severity:
          'MEDIUM' as const,

        category:
          'WEAK_CRYPTOGRAPHY',

        cwe:
          'CWE-328',
      },

      {
        regex:
          /\bsha1\s*\(/i,

        id:
          'PHP-SHA1',

        title:
          'Utilisation de SHA-1',

        severity:
          'MEDIUM' as const,

        category:
          'WEAK_CRYPTOGRAPHY',

        cwe:
          'CWE-328',
      },
    ];

    for (
      const check of
        checks
    ) {
      if (
        !check.regex.test(
          line,
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
          check.category,

        cweId:
          check.cwe,

        filePath:
          file,

        startLine:
          lineNumber,

        confidence:
          0.85,

        recommendation:
          'Revoir cette utilisation et employer une API plus sûre avec validation stricte des entrées.',

        metadata: {
          language:
            'PHP',
        },
      });
    }
  }
}
