export interface GithubRepositoryImportResult {
  repositoryId: string;
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
