import type {
  ScanContext,
} from '../contracts/scan-context';

import type {
  ScannerResult,
} from '../contracts/scanner-result';

import type {
  ScannerKind,
} from '../contracts/scanner-types';

import {
  ScannerRegistry,
} from '../registry/scanner-registry';

export interface ScannerExecutionOptions {
  requestedKinds:
    ScannerKind[];

  maxParallelScanners?:
    number;
}

export class ScannerExecutor {
  constructor(
    private readonly registry:
      ScannerRegistry,
  ) {}

  async execute(
    context: ScanContext,
    options:
      ScannerExecutionOptions,
  ): Promise<ScannerResult[]> {
    const scanners =
      this.registry
        .findCompatible(
          context,
          options.requestedKinds,
        );

    const maxParallel =
      Math.max(
        1,
        options
          .maxParallelScanners ??
          3,
      );

    const results:
      ScannerResult[] = [];

    for (
      let index = 0;
      index < scanners.length;
      index += maxParallel
    ) {
      const batch =
        scanners.slice(
          index,
          index +
            maxParallel,
        );

      const batchResults =
        await Promise.all(
          batch.map(
            async (
              scanner,
            ) => {
              try {
                return await scanner.scan(
                  context,
                );
              } catch (
                error: unknown
              ) {
                return {
                  scannerId:
                    scanner
                      .descriptor
                      .id,

                  scannerVersion:
                    scanner
                      .descriptor
                      .version,

                  rulesetVersion:
                    scanner
                      .descriptor
                      .rulesetVersion,

                  success:
                    false,

                  findings:
                    [],

                  statistics: {
                    filesConsidered:
                      0,

                    filesScanned:
                      0,

                    findingsCount:
                      0,

                    durationMs:
                      0,

                    skippedFiles:
                      0,
                  },

                  errors: [
                    error instanceof
                    Error
                      ? error.message
                      : 'Erreur scanner inconnue.',
                  ],
                };
              }
            },
          ),
        );

      results.push(
        ...batchResults,
      );
    }

    return results;
  }
}
