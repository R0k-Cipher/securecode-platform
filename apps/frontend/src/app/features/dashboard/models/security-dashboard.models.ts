import type {
  FindingSeverity,
  FindingStatus,
} from '../../findings/models/finding.models';

export interface DashboardSummary {
  repositories: number;

  scans: number;

  failedScans: number;

  findings: number;

  openFindings: number;

  securityScore: number | null;

  grade?: string | null;
}

export interface DashboardCweItem {
  category: string;

  count: number;
}

export interface DashboardSeverity {
  INFO: number;

  LOW: number;

  MEDIUM: number;

  HIGH: number;

  CRITICAL: number;

  [key: string]: number;
}

export interface DashboardOwaspItem {
  category: string;

  count: number;
}

export interface DashboardScoreHistoryItem {
  id: string;

  score: number | null;

  createdAt: string;

  status?: string;

  scanId?: string;
}

export interface DashboardRepository {
  id: string;

  name: string;

  fullName: string;

  provider?: string | null;
}

export interface DashboardScan {
  id: string;

  status: string;

  trigger: string;

  type?: string;

  score: number | null;

  createdAt: string;

  repository: DashboardRepository;
}

export interface DashboardFinding {
  id: string;

  title: string;

  severity: FindingSeverity;

  status: FindingStatus;

  filePath: string | null;

  repository: DashboardRepository;

  assignments?: Array<{
    id?: string;

    assignedTo?: {
      id?: string;

      email?: string;

      firstName?: string | null;

      lastName?: string | null;
    } | null;
  }>;
}

export interface SecurityDashboardProject {
  id: string;

  name: string;

  description?: string | null;
}

export interface DashboardWstgCategory {
  code: string;

  name: string;

  findings: number;

  critical: number;

  high: number;

  medium: number;

  low: number;

  info: number;

  score: number;

  grade: string;
}

export interface DashboardWstg {
  score: number;

  grade: string;

  categories: DashboardWstgCategory[];

  totalCategories: number;
}

export interface DashboardScanPerformance {
  averageScore: number | null;

  successRate: number;

  trend: 'UP' | 'DOWN' | 'STABLE';

  scoreDelta?: number | null;

  completedScans: number;
}

export interface SecurityDashboardResponse {
  project: SecurityDashboardProject;

  summary: DashboardSummary;

  severity: DashboardSeverity;

  owasp: DashboardOwaspItem[];

  scoreHistory: DashboardScoreHistoryItem[];

  criticalFindings: DashboardFinding[];

  recentScans: DashboardScan[];

  wstg?: DashboardWstg;

  cwe: DashboardCweItem[];

  scanPerformance?: DashboardScanPerformance;
}

/*
 * Nom utilisé par SecurityDashboardComponent
 * et SecurityDashboardService.
 */
export type SecurityDashboard = SecurityDashboardResponse;

export interface SecurityIntelligence {
  generatedAt: string;
  summary: {
    assessedFindings: number;
    knownExploited: number;
    reachable: number;
    internetExposed: number;
    openAttackPaths: number;
    distribution: Record<string, number>;
  };
  topRisks: Array<{
    id: string;
    findingId: string;
    contextualScore: number;
    priority: string;
    knownExploited: boolean;
    reachable: boolean | null;
    internetExposed: boolean | null;
    finding: DashboardFinding;
    explanation: string[];
  }>;
  attackPaths: Array<{
    id: string;
    title: string;
    severity: FindingSeverity;
    score: number;
    entryPoint: string | null;
    targetAsset: string | null;
    findingIds: string[];
    repository: DashboardRepository;
  }>;
}
