import { Injectable, inject } from '@angular/core';

import { ApiClientService } from '../../../core/api/api-client.service';

import type {
  SecurityDashboard,
  SecurityIntelligence,
} from '../models/security-dashboard.models';

@Injectable({
  providedIn: 'root',
})
export class SecurityDashboardService {
  private readonly api = inject(ApiClientService);

  getDashboard(organizationId: string, projectId: string) {
    return this.api.get<SecurityDashboard>(
      `/organizations/${organizationId}/projects/${projectId}/security-dashboard`,
    );
  }

  getIntelligence(organizationId: string, projectId: string) {
    return this.api.get<SecurityIntelligence>(
      `/organizations/${organizationId}/projects/${projectId}/security-intelligence`,
    );
  }
}
