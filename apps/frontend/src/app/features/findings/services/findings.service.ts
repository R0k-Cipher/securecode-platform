import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

import type {
  FindingDetail,
  FindingListItem,
  FindingSeverity,
  FindingsOverview,
  FindingStatus,
} from '../models/finding.models';

import type {
  PaginatedResponse,
} from '../../scans/services/scans.service';

@Injectable({
  providedIn: 'root',
})
export class FindingsService {
  private readonly api =
    inject(ApiClientService);

  list(
    organizationId: string,
    projectId: string,
    options?: {
      page?: number;
      perPage?: number;
      severity?: FindingSeverity;
      status?: FindingStatus;
      scanner?: string;
      search?: string;
      category?: string;
      cweId?: string;
      owaspCategory?: string;
      filePath?: string;
    },
  ) {
    return this.api.get<
      PaginatedResponse<FindingListItem>
    >(
      `/organizations/${organizationId}/projects/${projectId}/findings`,
      {
        page:
          options?.page ??
          1,

        perPage:
          options?.perPage ??
          25,

        severity:
          options?.severity,

        status:
          options?.status,

        scanner:
          options?.scanner,

        search:
          options?.search,

        category:
          options?.category,

        cweId:
          options?.cweId,

        owaspCategory:
          options?.owaspCategory,

        filePath:
          options?.filePath,
      },
    );
  }

  listByScan(
    organizationId: string,
    projectId: string,
    scanId: string,
    options?: {
      page?: number;
      perPage?: number;
      severity?: FindingSeverity;
      status?: FindingStatus;
      search?: string;
    },
  ) {
    return this.api.get<
      PaginatedResponse<FindingListItem>
    >(
      `/organizations/${organizationId}/projects/${projectId}/scans/${scanId}/findings`,
      {
        page:
          options?.page ??
          1,

        perPage:
          options?.perPage ??
          25,

        severity:
          options?.severity,

        status:
          options?.status,

        search:
          options?.search,
      },
    );
  }

  listByRepository(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    options?: {
      page?: number;
      perPage?: number;
      severity?: FindingSeverity;
      status?: FindingStatus;
      search?: string;
    },
  ) {
    return this.api.get<
      PaginatedResponse<FindingListItem>
    >(
      `/organizations/${organizationId}/projects/${projectId}/repositories/${repositoryId}/findings`,
      {
        page:
          options?.page ??
          1,

        perPage:
          options?.perPage ??
          25,

        severity:
          options?.severity,

        status:
          options?.status,

        search:
          options?.search,
      },
    );
  }

  getOne(
    organizationId: string,
    projectId: string,
    findingId: string,
  ) {
    return this.api.get<FindingDetail>(
      `/organizations/${organizationId}/projects/${projectId}/findings/${findingId}`,
    );
  }

  updateStatus(
    organizationId: string,
    projectId: string,
    findingId: string,
    status: FindingStatus,
    comment?: string,
  ) {
    return this.api.patch<FindingDetail>(
      `/organizations/${organizationId}/projects/${projectId}/findings/${findingId}/status`,
      {
        status,
        comment:
          comment?.trim() ||
          undefined,
      },
    );
  }

  overview(
    organizationId: string,
    projectId: string,
  ) {
    return this.api.get<FindingsOverview>(
      `/organizations/${organizationId}/projects/${projectId}/findings/overview`,
    );
  }
}
