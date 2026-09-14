export interface GithubInstallationAccount {
  id: number;
  login?: string;
  name?: string;
  type?: string;
  avatar_url?: string;
}

export interface GithubInstallation {
  id: number;

  app_id: number;

  target_id: number;

  target_type: string;

  repository_selection:
    | 'all'
    | 'selected';

  permissions:
    Record<string, string>;

  events:
    string[];

  account:
    GithubInstallationAccount;

  html_url:
    string;

  suspended_at:
    string | null;

  created_at:
    string;

  updated_at:
    string;
}

export interface GithubInstallationState {
  organizationId:
    string;

  projectId:
    string;

  userId:
    string;

  expiresAt:
    number;

  nonce:
    string;
}

export interface GithubInstallationTokenResponse {
  token:
    string;

  expires_at:
    string;

  permissions:
    Record<string, string>;

  repository_selection:
    'all'
    | 'selected';
}
