import * as ts from 'typescript';

import {
  JAVASCRIPT_TYPESCRIPT_SAST_RULES,
} from './javascript-typescript-rules';

describe(
  'JavaScript/TypeScript SAST rules',
  () => {
    function collectRuleIds(
      code: string,
    ): string[] {
      const sourceFile =
        ts.createSourceFile(
          'test.ts',
          code,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS,
        );

      const detected =
        new Set<string>();

      const visit =
        (
          node: ts.Node,
        ) => {
          for (
            const rule of
              JAVASCRIPT_TYPESCRIPT_SAST_RULES
          ) {
            if (
              rule.match(
                node,
                sourceFile,
              )
            ) {
              detected.add(
                rule.id,
              );
            }
          }

          ts.forEachChild(
            node,
            visit,
          );
        };

      visit(
        sourceFile,
      );

      return [
        ...detected,
      ];
    }

    it(
      'detects eval',
      () => {
        expect(
          collectRuleIds(
            `eval(userInput);`,
          ),
        ).toContain(
          'SAST-JS-001',
        );
      },
    );

    it(
      'detects dynamic SQL',
      () => {
        expect(
          collectRuleIds(
            'db.query(`SELECT * FROM users WHERE id = ${id}`);',
          ),
        ).toContain(
          'SAST-SQL-001',
        );
      },
    );

    it(
      'does not flag parameterized SQL',
      () => {
        expect(
          collectRuleIds(
            `db.query('SELECT * FROM users WHERE id = ?', [id]);`,
          ),
        ).not.toContain(
          'SAST-SQL-001',
        );
      },
    );

    it(
      'detects weak hash',
      () => {
        expect(
          collectRuleIds(
            `crypto.createHash('md5');`,
          ),
        ).toContain(
          'SAST-CRYPTO-001',
        );
      },
    );

    it(
      'detects disabled TLS verification',
      () => {
        expect(
          collectRuleIds(
            `const options = { rejectUnauthorized: false };`,
          ),
        ).toContain(
          'SAST-TLS-001',
        );
      },
    );
  },
);
