export interface GithubWebhookRepository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  default_branch: string;
  private: boolean;
  archived: boolean;
  owner: {
    login: string;
  };
}

export interface GithubWebhookInstallation {
  id: number;
}

export interface GithubPushWebhookPayload {
  ref: string;
  before: string;
  after: string;
  deleted: boolean;
  forced: boolean;
  repository: GithubWebhookRepository;
  installation?: GithubWebhookInstallation;
  sender: {
    login: string;
  };
}

export interface GithubPullRequestWebhookPayload {
  action: string;
  number: number;
  repository: GithubWebhookRepository;
  installation?: GithubWebhookInstallation;
  pull_request: {
    id: number;
    number: number;
    state: string;
    merged: boolean;
    base: {
      sha: string;
      ref: string;
    };
    head: {
      sha: string;
      ref: string;
    };
  };
}

export interface GithubReleaseWebhookPayload {
  action: string;
  repository: GithubWebhookRepository;
  installation?: GithubWebhookInstallation;
  release: {
    id: number;
    tag_name: string;
    target_commitish: string;
    draft: boolean;
    prerelease: boolean;
    published_at: string | null;
  };
}

export interface GithubInstallationWebhookPayload {
  action: 'created' | 'deleted' | 'suspend' | 'unsuspend' | string;
  installation: {
    id: number;
    repository_selection?: string;
    suspended_at?: string | null;
    account?: {
      id?: number;
      login?: string;
      name?: string | null;
    };
  };
}

export interface GithubInstallationRepositoriesWebhookPayload {
  action: 'added' | 'removed' | string;
  installation: GithubWebhookInstallation;
  repositories_added?: GithubWebhookRepository[];
  repositories_removed?: GithubWebhookRepository[];
}
