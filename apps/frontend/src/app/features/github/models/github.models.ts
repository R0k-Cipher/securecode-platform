export interface GithubInstallationUrlResponse {
  provider: 'GITHUB';

  alreadyConnected: boolean;

  connectionId: string | null;

  installationId: string | null;

  installationUrl: string | null;

  expiresInSeconds: number;
}

export interface GithubConnection {
  id:
    string;

  organizationId:
    string;

  provider:
    'GITHUB';

  externalAccountId:
    string;

  externalAccountName:
    string | null;

  installationId:
    string | null;

  repositorySelection:
    string | null;

  permissions:
    Record<
      string,
      unknown
    > | null;

  status:
    string;

  createdAt:
    string;

  updatedAt:
    string;
}

export interface GithubInstallationCallbackResponse {
  message: string;

  context: {
    organizationId: string;
    projectId: string;
  };

  connection: {
    id: string;
    organizationId: string;
    provider: 'GITHUB';
    externalAccountId: string;
    externalAccountName: string | null;
    installationId: string | null;
    status: string;
  };
}

export interface GithubRepository {
  id: number;

  nodeId:
    string;

  name:
    string;

  fullName:
    string;

  description:
    string | null;

  private:
    boolean;

  archived:
    boolean;

  disabled:
    boolean;

  fork:
    boolean;

  defaultBranch:
    string | null;

  htmlUrl:
    string;

  cloneUrl:
    string;

  sshUrl:
    string;

  language:
    string | null;

  size:
    number;

  imported?:
    boolean;

  localRepositoryId?:
    string | null;

  projectId?:
    string | null;

  syncStatus?:
    string | null;

  owner: {
    id:
      number;

    login:
      string;

    avatarUrl:
      string | null;

    type:
      string;
  };
}

export interface GithubRepositoryPage {
  items:
    GithubRepository[];

  installation?: {
    id:
      string;

    accountName:
      string | null;

    repositorySelection:
      'all' | 'selected';

    manageUrl:
      string;
  };

  pagination: {
    page:
      number;

    perPage:
      number;

    total:
      number;

    totalPages:
      number;

    hasNextPage:
      boolean;

    hasPreviousPage:
      boolean;
  };
}

export interface ImportGithubRepositoryResponse {
  repositoryId:
    string;

  repositorySyncId:
    string;

  projectId:
    string;

  gitConnectionId:
    string;

  provider:
    'GITHUB';

  externalRepositoryId:
    string;

  fullName:
    string;

  defaultBranch:
    string | null;

  latestCommitSha:
    string | null;

  created:
    boolean;

  syncQueued:
    boolean;
}
