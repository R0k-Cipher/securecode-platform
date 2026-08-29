export type SecurityScanProvider =
  | 'GITHUB'
  | 'GITLAB';

export type SecurityScanRequestedMode =
  | 'AUTO'
  | 'FULL'
  | 'INCREMENTAL'
  | 'PULL_REQUEST';

export type SecurityScanTrigger =
  | 'MANUAL'
  | 'PUSH'
  | 'PULL_REQUEST'
  | 'RELEASE'
  | 'SCHEDULED'
  | 'API';

export interface SecurityScanJobData {
  /*
   * Isolation multi-tenant
   */
  organizationId: string;

  /*
   * Identifiants internes SecureCode-AI
   */
  projectId: string;
  repositoryId: string;
  scanId: string;
  gitConnectionId: string;

  /*
   * Provider Git
   */
  provider: SecurityScanProvider;

  /*
   * Repository distant
   */
  repositoryExternalId: string;
  repositoryFullName: string;

  /*
   * Contexte Git
   */
  branch: string;

  /*
   * SHA de départ.
   */
  fromSha: string | null;

  /*
   * SHA cible.
   */
  toSha: string;

  /*
   * Pull Request éventuelle.
   */
  pullRequestId: string | null;

  /*
   * Mode d'analyse demandé.
   */
  requestedMode: SecurityScanRequestedMode;

  /*
   * Origine du scan.
   */
  trigger: SecurityScanTrigger;

  /*
   * Utilisateur ayant déclenché le scan.
   */
  triggeredById: string | null;

  /*
   * WebhookEvent éventuel.
   */
  eventId: string | null;

  /*
   * Observabilité.
   */
  requestedAt: string;
  correlationId: string;
}
