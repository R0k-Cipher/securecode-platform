import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../core/api/api-client.service';

import type {
  CreatePlatformOrganizationPayload,
  PlatformAdminSummary,
  PlatformAuditLog,
  PlatformOrganization,
  PlatformProject,
  PlatformRole,
  PlatformScan,
  PlatformSystemStatus,
  PlatformUser,
  PlatformUserStatus,

} from './platform-admin.models';

@Injectable({
  providedIn: 'root',
})
export class PlatformAdminService {
  private readonly api =
    inject(
      ApiClientService,
    );

  dashboard() {   
    return this.api.get<{
      summary:
        PlatformAdminSummary;

      latestUsers:
        PlatformUser[];

      latestAuditLogs:
        PlatformAuditLog[];
    }>(
      '/platform-admin/dashboard',
    );
  }

  users() {
    return this.api.get<
      PlatformUser[]
    >(
      '/platform-admin/users',
    );
  }

  organizations() {
    return this.api.get<
      PlatformOrganization[]
    >(
      '/platform-admin/organizations',
    );
  }

  projects() {
    return this.api.get<
      PlatformProject[]
    >(
      '/platform-admin/projects',
    );
  }

  scans() {
    return this.api.get<
      PlatformScan[]
    >(
      '/platform-admin/scans',
    );
  }

  auditLogs() {
    return this.api.get<
      PlatformAuditLog[]
    >(
      '/platform-admin/audit-logs',
    );
  }

  systemStatus() {
    return this.api.get<
      PlatformSystemStatus
    >(
      '/platform-admin/system',
    );
  }

  setStatus(
    id: string,
    status: PlatformUserStatus,
  ) {
    return this.api.patch<PlatformUser>(
      `/platform-admin/users/${id}/status`,
      {
        status,
      },
    );
  }

  setRole(
    id: string,
    platformRole: PlatformRole,
  ) {
    return this.api.patch<PlatformUser>(
      `/platform-admin/users/${id}/role`,
      {
        platformRole,
      },
    );
  }

  createOrganization(
    payload:
      CreatePlatformOrganizationPayload,
  ) {
    return this.api.post<
      PlatformOrganization
    >(
      '/organizations',
      payload,
    );
  }
}
