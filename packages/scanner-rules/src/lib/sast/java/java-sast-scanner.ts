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

export class JavaSastScanner
  extends BaseLanguageSastScanner
{
  readonly descriptor = {
    id:
      'java-sast',

    name:
      'SecureCode Java SAST',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'SAST' as const,

    scope:
      'FILE_LOCAL' as const,

    supportedExtensions: [
      '.java',
    ],
  };

  readonly languages =
    [
      'JAVA',
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
                    'JAVA',
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
              : 'Erreur Java scanner'
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
    const rules = [
      {
        regex:
          /Runtime\.getRuntime\(\)\.exec\s*\(/,

        id:
          'JAVA-RUNTIME-EXEC',

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
          /new\s+ObjectInputStream\s*\(/,

        id:
          'JAVA-OBJECT-DESERIALIZATION',

        title:
          'Désérialisation Java native',

        severity:
          'HIGH' as const,

        category:
          'UNSAFE_DESERIALIZATION',

        cwe:
          'CWE-502',
      },

      {
        regex:
          /MessageDigest\.getInstance\s*\(\s*["'](?:MD5|SHA-1)["']\s*\)/i,

        id:
          'JAVA-WEAK-HASH',

        title:
          'Algorithme cryptographique faible',

        severity:
          'MEDIUM' as const,

        category:
          'WEAK_CRYPTOGRAPHY',

        cwe:
          'CWE-328',
      },

      {
        regex:
          /Statement\s+\w+\s*=/,

        id:
          'JAVA-RAW-SQL-STATEMENT',

        title:
          'Utilisation directe de JDBC Statement',

        severity:
          'LOW' as const,

        category:
          'SQL_INJECTION',

        cwe:
          'CWE-89',
      },
    ];

    for (
      const rule of
        rules
    ) {
      if (
        !rule.regex.test(
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
          rule.cwe,

        filePath:
          file,

        startLine:
          lineNumber,

        recommendation:
          'Utiliser une API sûre et appliquer validation, paramétrage et moindre privilège.',

        confidence:
          0.8,

        metadata: {
          language:
            'JAVA',
        },
      });
    }
  }
}
