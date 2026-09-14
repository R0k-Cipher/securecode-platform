export type FindingSeverity =
  | 'INFO'
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL';

export type FindingStatus =
  | 'DETECTED'
  | 'TO_REVIEW'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'READY_FOR_RETEST'
  | 'FALSE_POSITIVE'
  | 'ACCEPTED_RISK'
  | 'FIXED'
  | 'REOPENED'
  | 'CLOSED';

export interface FindingRepository {
  id: string;
  name: string;
  fullName: string;
  provider?: string | null;
}

export interface FindingScan {
  id: string;
  type: string;
  status: string;
  commitSha: string | null;
  branch: string | null;
  createdAt: string;
}

export interface FindingOccurrence {
  id?: string;
  detectedAt?: string;

  [key: string]: unknown;
}

export interface FindingListItem {
  id: string;

  repositoryId: string;

  scanId: string;

  ruleId: string;

  scanner: string;

  fingerprint?: string;

  title: string;

  severity: FindingSeverity;

  status: FindingStatus;

  category: string | null;

  cweId: string | null;

  owaspCategory: string | null;

  filePath: string | null;

  startLine: number | null;

  startColumn?: number | null;

  confidence: number | null;

  firstDetectedAt: string;

  lastDetectedAt: string;

  resolvedAt?: string | null;

  repository?: FindingRepository | null;
}

export interface FindingDetail {
  id: string;

  ruleId: string;

  scanner: string;

  fingerprint: string;

  title: string;

  description: string | null;

  severity: FindingSeverity;

  status: FindingStatus;

  category: string | null;

  cweId: string | null;

  owaspCategory: string | null;

  filePath: string | null;

  startLine: number | null;

  startColumn: number | null;

  endLine: number | null;

  endColumn: number | null;

  codeSnippet: string | null;

  recommendation: string | null;

  confidence: number | null;

  metadata:
    | Record<string, unknown>
    | null;

  firstDetectedAt: string;

  lastDetectedAt: string;

  resolvedAt: string | null;

  createdAt: string;

  updatedAt: string;

  repository: FindingRepository;

  scan: FindingScan;

  occurrences: FindingOccurrence[];

  assignments?: FindingAssignment[];
}

export interface FindingAssignment {
  id: string;

  assignedToId?: string | null;

  assignedTo?: {
    id?: string;
    email?: string;
    firstName?: string | null;
    lastName?: string | null;
  } | null;

  createdAt?: string;

  updatedAt?: string;
}

export interface FindingsOverview {
  totalActive: number;

  bySeverity: Partial<
    Record<
      FindingSeverity,
      number
    >
  >;

  byStatus: Partial<
    Record<
      FindingStatus,
      number
    >
  >;
}
