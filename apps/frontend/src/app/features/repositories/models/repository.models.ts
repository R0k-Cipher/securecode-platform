export type GitProvider =
  | 'GITHUB'
  | 'GITLAB';

export type RepositorySyncStatus =
  | 'NOT_SYNCED'
  | 'PENDING'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED';

export interface RepositoryListItem {
  id: string;

  organizationId: string;
  projectId: string;
  gitConnectionId: string;

  provider: GitProvider;

  externalId: string;

  owner: string;
  name: string;
  fullName: string;

  description?: string | null;

  defaultBranch: string | null;

  cloneUrl?: string | null;
  sshUrl?: string | null;
  webUrl: string;

  visibility: string;

  isPrivate: boolean;
  isFork?: boolean;
  isArchived: boolean;

  primaryLanguage: string | null;

  lastRemoteCommitSha: string | null;

  syncStatus: RepositorySyncStatus;

  lastSyncedAt: string | null;

  createdAt?: string;
  updatedAt?: string;
}

export interface RepositoryPaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface RepositoryListResponse {
  data: RepositoryListItem[];
  meta: RepositoryPaginationMeta;
}
