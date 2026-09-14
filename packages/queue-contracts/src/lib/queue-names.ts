export const QUEUE_NAMES = {
  REPOSITORY_SYNC:
    'repository-sync',

  PROJECT_ANALYSIS:
    'project-analysis',

  SECURITY_SCAN:
    'security-scan',

  SCAN_SCHEDULER:
    'scan-scheduler',

  FINDING_PROCESSING:
    'finding-processing',

  REPORT_GENERATION:
    'report-generation',

  NOTIFICATIONS:
    'notifications',

  CLEANUP:
    'cleanup',
} as const;

export type QueueName =
  (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
