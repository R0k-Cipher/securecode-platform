import {
  readFile,
} from 'node:fs/promises';

import {
  resolve,
} from 'node:path';

import * as ts from 'typescript';

import type {
  ScanContext,
  ScannerFinding,
  ScannerResult,
  SecurityScanner,
} from '@securecode-platform/scanner-core';

import {
  JAVASCRIPT_TYPESCRIPT_SAST_RULES,
} from './javascript-typescript-rules';

import type {
  SastDetection,
  SastRule,
} from './sast-rule';

const SUPPORTED_EXTENSIONS =
  new Set([
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.ts',
    '.tsx',
    '.mts',
    '.cts',
  ]);

export class JavaScriptTypeScriptSastScanner
  implements SecurityScanner
{
  readonly descriptor = {
    id:
      'javascript-typescript-sast',

    name:
      'SecureCode JavaScript/TypeScript SAST',

    version:
      '1.0.0',

    rulesetVersion:
      '2026.08',

    kind:
      'SAST' as const,

    scope:
      'FILE_LOCAL' as const,

    supportedExtensions:
      [
        ...SUPPORTED_EXTENSIONS,
      ],
  };

  supports(
    context: ScanContext,
  ): boolean {
    return context.fileInventory.files
      .some(
        (file) =>
          !file.isBinary &&
          SUPPORTED_EXTENSIONS.has(
            file.extension,
          ),
      );
  }

  async scan(
    context: ScanContext,
  ): Promise<ScannerResult> {
    const startedAt =
      Date.now();

    const findings:
      ScannerFinding[] = [];

    const errors:
      string[] = [];

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

    /*
     * affectedFiles contient déjà :
     *
     * FULL        -> inventaire complet
     * INCREMENTAL -> fichiers impactés
     */
    const candidateFiles =
      context.affectedFiles.filter(
        (relativePath) => {
          const file =
            inventoryByPath.get(
              relativePath,
            );

          return Boolean(
            file &&
            !file.isBinary &&
            SUPPORTED_EXTENSIONS.has(
              file.extension,
            ),
          );
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

      if (
        !inventoryEntry ||
        inventoryEntry.isBinary
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

        const sourceFile =
          ts.createSourceFile(
            relativePath,

            content,

            ts.ScriptTarget.Latest,

            true,

            this.getScriptKind(
              relativePath,
            ),
          );

        filesScanned +=
          1;

        findings.push(
          ...this.analyzeSourceFile(
            sourceFile,
            relativePath,
          ),
        );
      } catch (
        error: unknown
      ) {
        skippedFiles +=
          1;

        errors.push(
          `${relativePath}: ${
            error instanceof Error
              ? error.message
              : 'Erreur inconnue'
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

      /*
       * Une erreur sur quelques fichiers
       * ne fait pas échouer tout le scanner.
       */
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
      },

      errors:
        errors.slice(
          0,
          100,
        ),
    };
  }

  private analyzeSourceFile(
    sourceFile:
      ts.SourceFile,

    filePath:
      string,
  ): ScannerFinding[] {
    const findings:
      ScannerFinding[] = [];

    const visit =
      (
        node:
          ts.Node,
      ): void => {
        for (
          const rule of
            JAVASCRIPT_TYPESCRIPT_SAST_RULES
        ) {
          const detection =
            rule.match(
              node,
              sourceFile,
            );

          if (!detection) {
            continue;
          }

          findings.push(
            this.createFinding(
              sourceFile,
              filePath,
              rule,
              detection,
            ),
          );
        }

        ts.forEachChild(
          node,
          visit,
        );
      };

    visit(
      sourceFile,
    );

    return findings;
  }

  private createFinding(
    sourceFile:
      ts.SourceFile,

    filePath:
      string,

    rule:
      SastRule,

    detection:
      SastDetection,
  ): ScannerFinding {
    const node =
      detection.node;

    const start =
      sourceFile
        .getLineAndCharacterOfPosition(
          node.getStart(
            sourceFile,
          ),
        );

    const end =
      sourceFile
        .getLineAndCharacterOfPosition(
          node.getEnd(),
        );

    const rawSnippet =
      node.getText(
        sourceFile,
      );

    return {
      ruleId:
        rule.id,

      title:
        rule.title,

      description:
        detection.description ??
        rule.description,

      severity:
        rule.severity,

      category:
        rule.category,

      cweId:
        rule.cweId,

      owaspCategory:
        rule.owaspCategory,

      filePath,

      startLine:
        start.line + 1,

      startColumn:
        start.character + 1,

      endLine:
        end.line + 1,

      endColumn:
        end.character + 1,

      codeSnippet:
        rawSnippet.slice(
          0,
          500,
        ),

      recommendation:
        detection.recommendation ??
        rule.recommendation,

      confidence:
        detection.confidence ??
        rule.confidence,

      metadata: {
        engine:
          'typescript-ast',

        ...(
          detection.metadata ??
          {}
        ),
      },
    };
  }

  private getScriptKind(
    filePath:
      string,
  ): ts.ScriptKind {
    const normalized =
      filePath.toLowerCase();

    if (
      normalized.endsWith(
        '.tsx',
      )
    ) {
      return ts.ScriptKind.TSX;
    }

    if (
      normalized.endsWith(
        '.jsx',
      )
    ) {
      return ts.ScriptKind.JSX;
    }

    if (
      normalized.endsWith(
        '.ts',
      ) ||
      normalized.endsWith(
        '.mts',
      ) ||
      normalized.endsWith(
        '.cts',
      )
    ) {
      return ts.ScriptKind.TS;
    }

    return ts.ScriptKind.JS;
  }
}
