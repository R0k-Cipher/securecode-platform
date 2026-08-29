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

import {
  SECRET_RULES,
} from './secret-rules';

import {
  sanitizeSnippet,
} from './secret-utils';

const MAX_DEFAULT_FILE_SIZE =
  5 *
  1024 *
  1024;

export class SecretScanner
  implements SecurityScanner
{
  readonly descriptor = {
    id:
      'secret-scanner',

    name:
      'SecureCode Secret Scanner',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'SECRET' as const,

    scope:
      'FILE_LOCAL' as const,
  };

  supports(
    context: ScanContext,
  ): boolean {
    return (
      context.workspacePath
        .length > 0
    );
  }

  async scan(
    context: ScanContext,
  ): Promise<ScannerResult> {
    const startedAt =
      Date.now();

    const findings:
      ScannerFinding[] = [];

    let filesScanned =
      0;

    let skippedFiles =
      0;

    const inventoryByPath =
      new Map(
        context.fileInventory.files.map(
          (file) => [
            file.relativePath,
            file,
          ],
        ),
      );

    const files = context.affectedFiles;

    for (
      const relativePath of files
    ) {
      if (
        this.shouldIgnore(
          relativePath,
        )
      ) {
        skippedFiles +=
          1;

        continue;
      }

      const inventoryEntry =
        inventoryByPath.get(
          relativePath,
        );

      if (
        !inventoryEntry ||
        inventoryEntry.isBinary
      ) {
        skippedFiles +=
          1;

        continue;
      }

      if (
        inventoryEntry.sizeBytes >
        MAX_DEFAULT_FILE_SIZE
      ) {
        skippedFiles +=
          1;

        continue;
      }

      const absolutePath =
        resolve(
          context.workspacePath,
          relativePath,
        );

      try {

        const content =
          await readFile(
            absolutePath,
            'utf8',
          );

        filesScanned +=
          1;

        findings.push(
          ...this.scanContent(
            content,
            relativePath,
          ),
        );
      } catch {
        skippedFiles +=
          1;
      }
    }

    return {
      scannerId:
        this.descriptor.id,

      scannerVersion:
        this.descriptor.version,

      rulesetVersion:
        this.descriptor
          .rulesetVersion,

      success:
        true,

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

        skippedFiles,
      },

      errors:
        [],
    };
  }

  private scanContent(
    content: string,
    filePath: string,
  ): ScannerFinding[] {
    const findings:
      ScannerFinding[] = [];

    const lines =
      content.split(
        /\r?\n/,
      );

    for (
      let lineIndex = 0;
      lineIndex <
      lines.length;
      lineIndex += 1
    ) {
      const line =
        lines[lineIndex];

      if (!line) {
        continue;
      }

      for (
        const rule of
          SECRET_RULES
      ) {
        /*
         * Les RegExp globales gardent
         * un lastIndex interne.
         */
        rule.pattern.lastIndex =
          0;

        let match:
          RegExpExecArray |
          null;

        while (
          (
            match =
              rule.pattern.exec(
                line,
              )
          ) !== null
        ) {
          const matchedValue =
            match[0];

          const sanitized =
            sanitizeSnippet(
              line,
              matchedValue,
            );

          findings.push({
            ruleId:
              rule.id,

            title:
              rule.title,

            description:
              rule.description,

            severity:
              rule.severity,

            category:
              'SECRET',

            filePath,

            startLine:
              lineIndex + 1,

            startColumn:
              match.index + 1,

            endLine:
              lineIndex + 1,

            endColumn:
              match.index +
              matchedValue.length +
              1,

            codeSnippet:
              sanitized.slice(
                0,
                500,
              ),

            recommendation:
              rule.recommendation,

            confidence:
              rule.confidence,

            metadata: {
              masked:
                true,
            },
          });

          if (
            match.index ===
            rule.pattern.lastIndex
          ) {
            rule.pattern.lastIndex +=
              1;
          }
        }
      }
    }

    return findings;
  }

  private shouldIgnore(
    filePath: string,
  ): boolean {
    const normalized =
      filePath
        .replace(/\\/g, '/')
        .toLowerCase();

    const excluded =
      [
        'node_modules/',
        'vendor/',
        '.git/',
        'dist/',
        'build/',
        'coverage/',
        '.next/',
        '.nuxt/',
        'target/',
        'bin/',
        'obj/',
      ];

    return excluded.some(
      (directory) =>
        normalized.includes(
          directory,
        ),
    );
  }
}
