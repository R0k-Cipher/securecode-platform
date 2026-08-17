import type {
  ConnectionStatus,
  GitProvider,
  RepositoryVisibility,
} from '@prisma/client';

export interface RepositoryGitConnectionResponse {
  id: string;
  provider: GitProvider;
  externalAccountId: string;
  externalAccountName: string | null;
  status: ConnectionStatus;
}

export interface RepositoryCountsResponse {
  commits: number;
  pullRequests: number;
  releases: number;
  webhookEvents: number;
  scans: number;
  findings: number;
}

export interface RepositoryResponse {
  id: string;
  projectId: string;
  gitConnectionId: string;
  provider: GitProvider;
  externalId: string;
  name: string;
  fullName: string;
  cloneUrl: string;
  webUrl: string;
  defaultBranch: string;
  visibility: RepositoryVisibility;
  isArchived: boolean;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  gitConnection?: RepositoryGitConnectionResponse;
  counts?: RepositoryCountsResponse;
}
