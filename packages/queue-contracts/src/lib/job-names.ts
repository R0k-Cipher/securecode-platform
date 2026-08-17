export const JOB_NAMES = {
  SYNC_REPOSITORY: 'sync-repository',
  RUN_FULL_SCAN: 'run-full-scan',
  RUN_INCREMENTAL_SCAN: 'run-incremental-scan',
  RUN_PULL_REQUEST_SCAN: 'run-pull-request-scan',
  PROCESS_FINDINGS: 'process-findings',
  GENERATE_REPORT: 'generate-report',
  SEND_NOTIFICATION: 'send-notification',
  CLEAN_WORKSPACE: 'clean-workspace',
} as const;

export type JobName =
  (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
