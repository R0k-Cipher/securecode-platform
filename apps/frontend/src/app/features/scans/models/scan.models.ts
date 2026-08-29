export type ScanStatus =
  | 'QUEUED'
  | 'PREPARING'
  | 'DOWNLOADING'
  | 'DETECTING'
  | 'SCANNING'
  | 'PROCESSING_RESULTS'
  | 'CALCULATING_SCORE'
  | 'GENERATING_REPORT'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ScanRepository {
  id:
    string;

  name:
    string;

  fullName:
    string;
}

export interface ScanProgress {
  id:
    string;

  status:
    ScanStatus;

  progress:
    number;

  score:
    number | null;

  errorMessage:
    string | null;

  startedAt:
    string | null;

  completedAt:
    string | null;

  failedAt:
    string | null;

  updatedAt:
    string;
}

export interface ScanListItem {
  id:
    string;

  type:
    string;

  trigger:
    string;

  status:
    ScanStatus;

  branch:
    string | null;

  commitSha:
    string | null;

  progress:
    number;

  score:
    number | null;

  statistics:
    Record<
      string,
      unknown
    > | null;

  createdAt:
    string;

  startedAt:
    string | null;

  completedAt:
    string | null;

  repository?:
    ScanRepository;

  _count?: {
    findings:
      number;
  };
}

export interface ScanDetail
  extends ScanListItem {
  errorMessage?:
    string | null;

  failedAt?:
    string | null;

  updatedAt?:
    string;
}
