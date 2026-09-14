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


/*
|--------------------------------------------------------------------------
| Scan statistics
|--------------------------------------------------------------------------
|
| Propriétés actuellement produites par le scanner.
| L'index signature permet également au backend
| d'ajouter de nouvelles métriques sans casser
| le frontend.
|--------------------------------------------------------------------------
*/

export interface ScanStatistics {
  findingsCount?:
    number;

  newFindings?:
    number;

  existingFindings?:
    number;

  reopenedFindings?:
    number;

  fixedFindings?:
    number;

  activeCritical?:
    number;

  activeHigh?:
    number;

  activeMedium?:
    number;

  activeLow?:
    number;

  activeInfo?:
    number;

  cacheHits?:
    number;

  cacheMisses?:
    number;

  inventoryFileCount?:
    number;

  changedFileCount?:
    number;

  securityScoreReliable?:
    boolean;

  partial?:
    boolean;

  [key: string]:
    unknown;
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
    ScanStatistics | null;

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
  configuration?:
    Record<
      string,
      unknown
    > | null;

  errorMessage?:
    string | null;

  failedAt?:
    string | null;

  updatedAt?:
    string;

  repository?:
    ScanRepository & {
      provider?:
        string;

      owner?:
        string;

      defaultBranch?:
        string | null;

      primaryLanguage?:
        string | null;

      lastRemoteCommitSha?:
        string | null;
    };
}
