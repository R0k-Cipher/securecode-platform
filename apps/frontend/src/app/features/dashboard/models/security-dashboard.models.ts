export interface DashboardProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  defaultBranch: string | null;
}

export interface DashboardSeverity {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface DashboardSummary {
  repositories: number;
  scans: number;
  findings: number;
  openFindings: number;
  securityScore: number | null;
  severity: DashboardSeverity;
}

export interface DashboardRepository {
  id: string;
  provider: 'GITHUB' | 'GITLAB';
  name: string;
  fullName: string;
  primaryLanguage: string | null;
  syncStatus: string;
  lastSyncedAt: string | null;
}

export interface DashboardScan {
  id: string;
  type: string;
  trigger?: string;
  status: string;
  score: number | null;
  progress: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;

  repository: {
    id: string;
    name: string;
    fullName: string;
  };

  _count?: {
    findings: number;
  };
}

export interface SecurityDashboardResponse {
  project: DashboardProject;
  summary: DashboardSummary;
  latestScan: DashboardScan | null;
  repositories: DashboardRepository[];
  recentScans: DashboardScan[];
}
