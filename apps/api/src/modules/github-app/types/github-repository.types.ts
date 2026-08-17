export interface GithubRepositoryOwner {
  id: number;
  login: string;
  avatarUrl: string | null;
  type: string;
}

export interface GithubInstallationRepository {
  id: number;
  nodeId: string;
  name: string;
  fullName: string;
  description: string | null;

  private: boolean;
  archived: boolean;
  disabled: boolean;
  fork: boolean;

  defaultBranch: string | null;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;

  language: string | null;
  size: number;

  owner: GithubRepositoryOwner;

  createdAt: string | null;
  updatedAt: string | null;
  pushedAt: string | null;
}

export interface GithubRepositoryPage {
  items: GithubInstallationRepository[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}
