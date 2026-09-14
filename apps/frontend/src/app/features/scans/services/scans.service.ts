import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

import type {
  ScanDetail,
  ScanListItem,
  ScanProgress,
  ScanStatus,
} from '../models/scan.models';

export interface PaginatedResponse<T> {
  items:
    T[];

  pagination: {
    page:
      number;

    perPage:
      number;

    total:
      number;

    totalPages:
      number;

    hasNextPage:
      boolean;

    hasPreviousPage:
      boolean;
  };
}

@Injectable({
  providedIn:
    'root',
})
export class ScansService {
  private readonly api =
    inject(
      ApiClientService,
    );

  listProjectScans(
    organizationId:
      string,

    projectId:
      string,

    options?: {
      page?:
        number;

      perPage?:
        number;

      status?:
        ScanStatus;

      repositoryId?:
        string;
    },
  ) {
    return this.api.get<
      PaginatedResponse<
        ScanListItem
      >
    >(
      `/organizations/${organizationId}/projects/${projectId}/scans`,
      {
        page:
          options?.page ??
          1,

        perPage:
          options?.perPage ??
          20,

        status:
          options?.status,

        repositoryId:
          options
            ?.repositoryId,
      },
    );
  }

  listRepositoryScans(
    organizationId:
      string,

    projectId:
      string,

    repositoryId:
      string,

    page =
      1,
  ) {
    return this.api.get<
      PaginatedResponse<
        ScanListItem
      >
    >(
      `/organizations/${organizationId}/projects/${projectId}/repositories/${repositoryId}/scans`,
      {
        page,

        perPage:
          20,
      },
    );
  }

  getScan(
    organizationId:
      string,

    projectId:
      string,

    scanId:
      string,
  ) {
    return this.api.get<
      ScanDetail
    >(
      `/organizations/${organizationId}/projects/${projectId}/scans/${scanId}`,
    );
  }

  progress(
    organizationId:
      string,

    projectId:
      string,

    scanId:
      string,
  ) {
    return this.api.get<
      ScanProgress
    >(
      `/organizations/${organizationId}/projects/${projectId}/scans/${scanId}/progress`,
    );
  }

  createManual(
    organizationId:
      string,

    projectId:
      string,

    repositoryId:
      string,
  ) {
    return this.api.post<{
      scanId:
        string;

      repositoryId:
        string;

      status:
        ScanStatus;

      correlationId:
        string;
    }>(
      `/organizations/${organizationId}/projects/${projectId}/repositories/${repositoryId}/scans`,
      {},
    );
  }

  cancel(
    organizationId:
      string,

    projectId:
      string,

    scanId:
      string,
  ) {
    return this.api.post(
      `/organizations/${organizationId}/projects/${projectId}/scans/${scanId}/cancel`,
      {},
    );
  }
}
