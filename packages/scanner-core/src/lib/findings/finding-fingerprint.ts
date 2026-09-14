import {
  createHash,
} from 'node:crypto';

import type {
  ScannerFinding,
} from '../contracts/scanner-result';

export interface FindingFingerprintInput {
  repositoryId: string;

  scannerId: string;

  finding: ScannerFinding;
}

export function createFindingFingerprint(
  input:
    FindingFingerprintInput,
): string {
  const normalizedPath =
    input.finding.filePath
      ?.replace(/\\/g, '/')
      .toLowerCase() ??
    '';

  const normalizedRuleId =
    input.finding.ruleId
      .trim()
      .toLowerCase();

  const normalizedTitle =
    input.finding.title
      .trim()
      .toLowerCase();

  const identity =
    [
      input.repositoryId,
      input.scannerId,
      normalizedRuleId,
      normalizedPath,
      normalizedTitle,
    ].join('|');

  return createHash(
    'sha256',
  )
    .update(
      identity,
      'utf8',
    )
    .digest(
      'hex',
    );
}
