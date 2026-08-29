import type {
  ScanContext,
} from './scan-context';

import type {
  ScannerResult,
} from './scanner-result';

export type ScanMode =
  | 'FULL'
  | 'INCREMENTAL'
  | 'PULL_REQUEST';

export type ScannerExecutionScope =
  | 'FILE_LOCAL'
  | 'PROJECT_CONTEXT'
  | 'DEPENDENCY_GRAPH'
  | 'DIFF_ONLY'
  | 'GLOBAL';

export type ScannerKind =
  | 'SECRET'
  | 'SAST'
  | 'DEPENDENCY'
  | 'CONTAINER'
  | 'CONFIGURATION'
  | 'CI_CD'
  | 'API'
  | 'INFRASTRUCTURE';

export interface ScannerDescriptor {
  id: string;

  name: string;

  version: string;

  rulesetVersion: string;

  kind: ScannerKind;

  scope: ScannerExecutionScope;

  supportedExtensions?: string[];

  supportedFiles?: string[];
}

export interface SecurityScanner {
  readonly descriptor:
    ScannerDescriptor;

  supports(
    context: ScanContext,
  ): boolean;

  scan(
    context: ScanContext,
  ): Promise<ScannerResult>;
}
