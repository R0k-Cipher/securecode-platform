import type {
  ProjectStatus,
  ScanStatus,
} from '@prisma/client';

export interface ProjectCreatorResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
}

export interface ProjectLastScanResponse {
  id: string;
  status: ScanStatus;
  score: number | null;
  branch: string;
  commitSha: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface ProjectResponse {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  defaultBranch: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  archivedAt: Date | null;

  createdBy?: ProjectCreatorResponse;

  membersCount?: number;
  repositoriesCount?: number;
  scansCount?: number;
  findingsCount?: number;
  vulnerabilitiesCount?: number;
  reportsCount?: number;

  lastScan?: ProjectLastScanResponse | null;
}
