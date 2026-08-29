export interface GithubRepositoryImportResult {
  repositoryId: string;

  repositorySyncId: string;

  projectId: string;

  gitConnectionId: string;

  provider: 'GITHUB';

  externalRepositoryId: string;

  fullName: string;

  defaultBranch: string | null;

  latestCommitSha: string | null;

  created: boolean;

  syncQueued: boolean;
}
