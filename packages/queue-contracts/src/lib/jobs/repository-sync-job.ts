export type GitProviderJob =
  | 'GITHUB'
  | 'GITLAB';

export type RepositorySyncTriggerJob =
  | 'INITIAL_IMPORT'
  | 'MANUAL'
  | 'WEBHOOK'
  | 'SCHEDULED'
  | 'RETRY';

export type RepositorySyncEventType =
  | 'PUSH'
  | 'PULL_REQUEST'
  | 'MERGE_REQUEST'
  | 'RELEASE'
  | 'INSTALLATION'
  | 'INSTALLATION_REPOSITORIES'
  | null;

export interface RepositorySyncJobData {
  /*
   * Isolation multi-tenant.
   */
  organizationId: string;

  /*
   * Identifiants internes SecureCode.
   */
  projectId: string;
  repositoryId: string;
  repositorySyncId: string;
  gitConnectionId: string;

  /*
   * Provider.
   */
  provider: GitProviderJob;

  /*
   * Repository distant.
   */
  repositoryExternalId: string;
  repositoryFullName: string;

  /*
   * Révision ciblée.
   */
  branch: string | null;
  commitSha: string | null;

  /*
   * Origine de la synchronisation.
   */
  trigger: RepositorySyncTriggerJob;
  eventType: RepositorySyncEventType;

  /*
   * Identifiant webhook éventuel.
   */
  eventId: string | null;

  /*
   * null pour les opérations automatiques.
   */
  triggeredById: string | null;

  /*
   * Observabilité.
   */
  requestedAt: string;
  correlationId: string;
}
