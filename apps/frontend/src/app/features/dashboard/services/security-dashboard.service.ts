import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

import type {
  SecurityDashboardResponse,
} from '../models/security-dashboard.models';

@Injectable({
  providedIn: 'root',
})
export class SecurityDashboardService {
  private readonly api =
    inject(ApiClientService);

  getProjectDashboard(
    organizationId: string,
    projectId: string,
  ) {
    return this.api.get<SecurityDashboardResponse>(
      `/organizations/${organizationId}/projects/${projectId}/security-dashboard`,
    );
  }
}
