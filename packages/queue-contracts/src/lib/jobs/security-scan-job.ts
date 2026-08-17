export type ScanMode =
  | 'FULL'
  | 'INCREMENTAL'
  | 'PULL_REQUEST'
  | 'RELEASE';

export interface SecurityScanJobData {
  scanId: string;
  projectId: string;
  repositoryId: string;

  commitSha: string;
  branch: string;
  mode: ScanMode;

  changedFiles?: string[];

  correlationId: string;
  requestedAt: string;
}
