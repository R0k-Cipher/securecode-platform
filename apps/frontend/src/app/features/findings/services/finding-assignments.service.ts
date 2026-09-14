import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

@Injectable({
  providedIn: 'root',
})
export class FindingAssignmentsService {
  private readonly api =
    inject(ApiClientService);

  assign(
    organizationId: string,
    projectId: string,
    findingId: string,
    assignedToId: string,
  ) {
    return this.api.post<any>(
      `/organizations/${organizationId}/projects/${projectId}/findings/${findingId}/assign`,
      {
        assignedToId,
      },
    );
  }


  unassign(
    organizationId: string,
    projectId: string,
    findingId: string,
  ) {
    return this.api.delete<any>(
      `/organizations/${organizationId}/projects/${projectId}/findings/${findingId}/assignment`,
    );
  }

  getActive(
    organizationId: string,
    projectId: string,
    findingId: string,
  ) {
    return this.api.get<any>(
      `/organizations/${organizationId}/projects/${projectId}/findings/${findingId}/assignment`,
    );
  }

  markReadyForRetest(
    organizationId: string,
    projectId: string,
    findingId: string,
  ) {
    return this.api.patch<{
      message: string;

      finding: {
        id: string;
        status: string;
      };
    }>(
      `/organizations/${organizationId}/projects/${projectId}/my-tasks/${findingId}/ready-for-retest`,
      {},
    );
  }

  startWork(
    organizationId: string,
    projectId: string,
    findingId: string,
  ) {
    return this.api.patch<{
      message: string;

      finding: {
        id: string;
        status: string;
      };
    }>(
      `/organizations/${organizationId}/projects/${projectId}/my-tasks/${findingId}/start`,
      {},
    );
  }

  myTasks(
    organizationId: string,
    projectId: string,
  ) {
    return this.api.get<any[]>(
      `/organizations/${organizationId}/projects/${projectId}/my-tasks`,
    );
  }
}
