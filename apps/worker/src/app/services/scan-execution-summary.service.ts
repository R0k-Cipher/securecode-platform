import {
  Injectable,
} from '@nestjs/common';

import type {
  ScannerResult,
  ScanExecutionSummary,
} from '@securecode-platform/scanner-core';

@Injectable()
export class ScanExecutionSummaryService {
  build(
    results: ScannerResult[],
  ): ScanExecutionSummary {
    const scanners =
      results.map(
        (result) => ({
          scannerId:
            result.scannerId,

          scannerVersion:
            result.scannerVersion,

          rulesetVersion:
            result.rulesetVersion,

          success:
            result.success,

          findingsCount:
            result.findings.length,

          filesConsidered:
            result.statistics.filesConsidered,

          filesScanned:
            result.statistics.filesScanned,

          skippedFiles:
            result.statistics.skippedFiles,

          durationMs:
            result.statistics.durationMs,

          cacheHits:
            result.statistics.cacheHits ?? 0,

          cacheMisses:
            result.statistics.cacheMisses ?? 0,

          errors:
            result.errors.slice(0, 20),
        }),
      );

    const successfulScanners =
      scanners.filter(
        (scanner) =>
          scanner.success,
      ).length;

    const failedScanners =
      scanners.length -
      successfulScanners;

    return {
      complete:
        failedScanners === 0,

      partial:
        failedScanners > 0,

      totalScanners:
        scanners.length,

      successfulScanners,

      failedScanners,

      totalDurationMs:
        scanners.reduce(
          (
            total,
            scanner,
          ) =>
            total +
            scanner.durationMs,
          0,
        ),

      totalFindings:
        scanners.reduce(
          (
            total,
            scanner,
          ) =>
            total +
            scanner.findingsCount,
          0,
        ),

      cacheHits:
        scanners.reduce(
          (
            total,
            scanner,
          ) =>
            total +
            scanner.cacheHits,
          0,
        ),

      cacheMisses:
        scanners.reduce(
          (
            total,
            scanner,
          ) =>
            total +
            scanner.cacheMisses,
          0,
        ),

      scanners,
    };
  }
}
