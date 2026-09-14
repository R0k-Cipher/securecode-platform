export const PERMISSION_CODES = {

  ORGANIZATION_READ: 'organization:read',
  ORGANIZATION_UPDATE: 'organization:update',
  ORGANIZATION_DELETE: 'organization:delete',

  MEMBER_READ: 'member:read',
  MEMBER_INVITE: 'member:invite',
  MEMBER_UPDATE: 'member:update',
  MEMBER_DELETE: 'member:delete',


  INVITATION_READ: 'invitation:read',
  INVITATION_CANCEL: 'invitation:cancel',


  PROJECT_LIST: 'project:list',
  PROJECT_CREATE: 'project:create',
  PROJECT_READ: 'project:read',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',
  PROJECT_ARCHIVE: 'project:archive',
  PROJECT_RESTORE: 'project:restore',


  PROJECT_MEMBER_READ: 'project-member:read',
  PROJECT_MEMBER_MANAGE: 'project-member:manage',


  GIT_CONNECTION_CREATE: 'git-connection:create',
  GIT_CONNECTION_READ: 'git-connection:read',
  GIT_CONNECTION_UPDATE: 'git-connection:update',
  GIT_CONNECTION_DELETE: 'git-connection:delete',


  REPOSITORY_CREATE: 'repository:create',
  REPOSITORY_READ: 'repository:read',
  REPOSITORY_UPDATE: 'repository:update',
  REPOSITORY_DELETE: 'repository:delete',
  REPOSITORY_SYNC: 'repository:sync',


  SCAN_CREATE: 'scan:create',
  SCAN_READ: 'scan:read',
  SCAN_CANCEL: 'scan:cancel',


  FINDING_READ: 'finding:read',
  FINDING_UPDATE: 'finding:update',
  FINDING_ASSIGN: 'finding:assign',


  REPORT_READ: 'report:read',
  REPORT_EXPORT: 'report:export',

  
  ORGANIZATION_REPORT_READ:'organization-report:read',
  ORGANIZATION_REPORT_EXPORT:'organization-report:export',


  AUDIT_LOG_READ: 'audit-log:read',


} as const;

export type PermissionCode =
  (typeof PERMISSION_CODES)[keyof typeof PERMISSION_CODES];
