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
   * Isolation multi-tenant.
   */
  organizationId: string;

  /*
   * Identifiants SecureCode.
   */
  projectId: string;
  repositoryId: string;
  scanId: string;
  gitConnectionId: string;

  /*
   * Provider Git.
   */
  provider: SecurityScanProvider;

  /*
   * Repository distant.
   */
  repositoryExternalId: string;
  repositoryFullName: string;

  /*
   * Contexte Git.
   */
  branch: string;

  /*
   * SHA précédent éventuel.
   */
  fromSha: string | null;

  /*
   * SHA exact à analyser.
   */
  toSha: string;

  /*
   * Pull Request éventuelle.
   */
  pullRequestId: string | null;

  /*
   * Mode technique demandé.
   *
   * AUTO sera résolu par le worker en
   * FULL ou INCREMENTAL.
   */
  requestedMode: SecurityScanRequestedMode;

  /*
   * Origine métier du scan.
   */
  trigger: SecurityScanTrigger;

  /*
   * Utilisateur déclencheur.
   *
   * null pour webhook/scheduler.
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
