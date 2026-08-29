import {
  Injectable,
} from '@nestjs/common';

import type {
  ScannerFinding,
  ScannerResult,
} from '@securecode-platform/scanner-core';

import {
  createFindingFingerprint,
} from '@securecode-platform/scanner-core';

export interface NormalizedFinding {
  scanner:
    string;

  scannerVersion:
    string;

  rulesetVersion:
    string;

  fingerprint:
    string;

  finding:
    ScannerFinding;
}

@Injectable()
export class FindingNormalizerService {
  normalize(
    repositoryId:
      string,

    results:
      ScannerResult[],
  ): NormalizedFinding[] {
    const normalized:
      NormalizedFinding[] = [];

    for (
      const result of
        results
    ) {
      if (
        !result.success
      ) {
        continue;
      }

      for (
        const finding of
          result.findings
      ) {
        normalized.push({
          scanner:
            result.scannerId,

          scannerVersion:
            result.scannerVersion,

          rulesetVersion:
            result.rulesetVersion,

          fingerprint:
            createFindingFingerprint({
              repositoryId,

              scannerId:
                result.scannerId,

              finding,
            }),

          finding,
        });
      }
    }

    return normalized;
  }
}
