export interface RepositorySyncJobData {
  eventId: string;
  projectId: string;
  repositoryId: string;

  provider: 'GITHUB' | 'GITLAB';

  repositoryExternalId: string;
  repositoryFullName: string;

  commitSha: string;
  branch: string;

  requestedAt: string;
  correlationId: string;
}
