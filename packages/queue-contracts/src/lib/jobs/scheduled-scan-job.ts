export interface ScheduledScanJobData {
  scheduleId: string;

  /*
   * Contexte multi-tenant copié dans le job.
   *
   * Le worker vérifiera ensuite ces valeurs
   * contre PostgreSQL.
   */
  organizationId: string;
  projectId: string;
  repositoryId: string;
}
