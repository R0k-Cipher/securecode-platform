export type PlatformUserStatus =
  | 'ACTIVE'
  | 'INVITED'
  | 'SUSPENDED'
  | 'DISABLED';

export type PlatformRole =
  | 'USER'
  | 'PLATFORM_ADMIN';

export interface PlatformAdminSummary {
  users:
    number;

  activeUsers:
    number;

  organizations:
    number;

  projects:
    number;

  repositories:
    number;

  pendingInvitations:
    number;

  activeGitConnections:
    number;

  gitConnectionErrors:
    number;

  auditEvents24h:
    number;

  activeSessions:
    number;
}

export interface PlatformUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: PlatformUserStatus;
  platformRole: PlatformRole;
  lastLoginAt: string | null;
  createdAt: string;
  _count: {
    organizationMemberships: number;
    createdProjects: number;
  };
}

export interface PlatformOrganization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  _count: {
    members: number;
    projects: number;
    repositories: number;
  };
}

export interface PlatformProject {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  createdBy: {
    id: string;
    email: string;
  };
  _count: {
    repositories: number;
    scans: number;
    findings: number;
    members: number;
  };
}

export interface PlatformScan {
  id: string;
  type: string;
  trigger: string;
  status: string;
  branch: string;
  commitSha: string;
  score: number | null;
  progress: number;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  errorMessage: string | null;
  project: {
    id: string;
    name: string;
  };
  repository: {
    id: string;
    fullName: string;
  };
  requestedBy: {
    id: string;
    email: string;
  } | null;
  _count: {
    findings: number;
  };
}
export interface PlatformAuditLog {
  id:
    string;

  action:
    string;

  resourceType:
    string;

  resourceId:
    string |
    null;

  description:
    string |
    null;

  ipAddress:
    string |
    null;

  userAgent:
    string |
    null;

  metadata:
    Record<
      string,
      unknown
    > |
    null;

  createdAt:
    string;

  actor: {
    id:
      string;

    email:
      string;

    firstName:
      string;

    lastName:
      string;

    platformRole:
      PlatformRole;
  } |
  null;

  organization: {
    id:
      string;

    name:
      string;

    slug:
      string;
  } |
  null;

  project: {
    id:
      string;

    name:
      string;

    slug:
      string;
  } |
  null;
}

export interface CreatePlatformOrganizationPayload {
  name: string;

  slug?: string;

  description?: string;

  logoUrl?: string;

  ownerEmail: string;

  ownerFirstName: string;

  ownerLastName: string;
}

export interface PlatformSystemStatus {
  status: 'HEALTHY' | 'DEGRADED';
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: 'UP' | 'DOWN';
  };
  scans: {
    queued: number;
    running: number;
    failed: number;
  };
  repositorySyncs: {
    queued: number;
    running: number;
    failed: number;
  };
  webhooks: {
    received: number;
    failed: number;
  };
}
