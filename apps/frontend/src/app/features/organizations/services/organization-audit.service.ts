import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

export interface OrganizationAuditLog {
  id: string;

  action: string;

  resourceType: string;

  resourceId: string | null;

  description: string | null;

  ipAddress: string | null;

  userAgent: string | null;

  metadata?: unknown;

  createdAt: string;

  actor:
    | {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
      }
    | null;

  project:
    | {
        id: string;
        name: string;
      }
    | null;
}

@Injectable({
  providedIn: 'root',
})
export class OrganizationAuditService {
  private readonly api =
    inject(
      ApiClientService,
    );

  list(
    organizationId: string,
    limit = 200,
  ) {
    return this.api.get<{
      data: OrganizationAuditLog[];
    }>(
      `/organizations/${organizationId}/audit-logs?limit=${limit}`,
    );
  }

  listProject(
    organizationId: string,
    projectId: string,
    limit = 200,
  ) {
    return this.api.get<{
      data: OrganizationAuditLog[];
    }>(
      `/organizations/${organizationId}/projects/${projectId}/audit-logs?limit=${limit}`,
    );
  }
}
