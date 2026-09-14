import type {
  ConnectionStatus,
  GitProvider,
  RepositorySyncStatus,
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

  organizationId: string;
  projectId: string;
  gitConnectionId: string;
  createdById: string;

  provider: GitProvider;

  externalId: string;
  nodeId: string | null;

  owner: string;
  name: string;
  fullName: string;
  description: string | null;

  defaultBranch: string | null;

  cloneUrl: string | null;
  sshUrl: string | null;
  webUrl: string;

  visibility: RepositoryVisibility;

  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;

  primaryLanguage: string | null;
  lastRemoteCommitSha: string | null;

  syncStatus: RepositorySyncStatus;
  lastSyncedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;

  gitConnection?: RepositoryGitConnectionResponse;
  counts?: RepositoryCountsResponse;
}
