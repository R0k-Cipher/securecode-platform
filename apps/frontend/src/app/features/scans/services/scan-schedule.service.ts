import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

export type ScanScheduleMode =
  | 'AUTO'
  | 'FULL';

export interface ScanSchedule {
  id: string;

  organizationId: string;

  projectId: string;

  repositoryId: string;

  cronExpression: string;

  timezone: string;

  mode: ScanScheduleMode;

  enabled: boolean;

  createdAt: string;

  updatedAt: string;
}

export interface UpsertScanSchedule {
  cronExpression: string;

  timezone: string;

  mode: ScanScheduleMode;

  enabled: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ScanScheduleService {
  private readonly api =
    inject(
      ApiClientService,
    );

  get(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    return this.api.get<ScanSchedule>(
      this.buildUrl(
        organizationId,
        projectId,
        repositoryId,
      ),
    );
  }

  save(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    input: UpsertScanSchedule,
  ) {
    return this.api.put<ScanSchedule>(
      this.buildUrl(
        organizationId,
        projectId,
        repositoryId,
      ),
      input,
    );
  }

  remove(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    return this.api.delete<void>(
      this.buildUrl(
        organizationId,
        projectId,
        repositoryId,
      ),
    );
  }

  private buildUrl(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ): string {
    return (
      `/organizations/${organizationId}` +
      `/projects/${projectId}` +
      `/repositories/${repositoryId}` +
      `/scan-schedule`
    );
  }
}
