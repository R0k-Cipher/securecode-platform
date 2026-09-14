import {
  ScannerCore,
} from './scanner-core';

describe(
  'ScannerCore',
  () => {
    it(
      'should create an incremental scan plan',
      () => {
        const scanner =
          new ScannerCore();

        const plan =
          scanner.planScan({
            repositoryId:
              'repo-1',

            fromSha:
              'abc',

            toSha:
              'def',

            added: [],

            modified: [
              'src/auth/auth.service.ts',
              'package-lock.json',
              'Dockerfile',
            ],

            deleted: [],

            renamed: [],

            changedFileCount:
              3,

            requiresFullScan:
              false,

            fullScanReasons:
              [],
          });

        expect(
          plan.mode,
        ).toBe(
          'INCREMENTAL',
        );

        expect(
          plan.scanners,
        ).toContain(
          'SAST',
        );

        expect(
          plan.scanners,
        ).toContain(
          'DEPENDENCY',
        );

        expect(
          plan.scanners,
        ).toContain(
          'CONTAINER',
        );

        expect(
          plan.requiresProjectContext,
        ).toBe(
          true,
        );
      },
    );

    it(
      'should fallback to full scan when no previous sha exists',
      () => {
        const scanner =
          new ScannerCore();

        const plan =
          scanner.planScan({
            repositoryId:
              'repo-1',

            fromSha:
              null,

            toSha:
              'def',

            added: [],

            modified: [],

            deleted: [],

            renamed: [],

            changedFileCount:
              0,

            requiresFullScan:
              false,

            fullScanReasons:
              [],
          });

        expect(
          plan.mode,
        ).toBe(
          'FULL',
        );
      },
    );
  },
);
