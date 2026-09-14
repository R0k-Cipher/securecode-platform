import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

import type {
  RepositoryListResponse,
  RepositoryListItem,
} from '../models/repository.models';

@Injectable({
  providedIn: 'root',
})
export class RepositoriesService {
  private readonly api =
    inject(ApiClientService);

  list(
    organizationId: string,
    projectId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      provider?: string;
      visibility?: string;
      isArchived?: boolean;
    },
  ) {
    return this.api.get<RepositoryListResponse>(
      `/organizations/${organizationId}/projects/${projectId}/repositories`,
      params,
    );
  }

  getOne(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    return this.api.get<RepositoryListItem>(
      `/organizations/${organizationId}/projects/${projectId}/repositories/${repositoryId}`,
    );
  }

  securityOverview(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    return this.api.get(
      `/organizations/${organizationId}/projects/${projectId}/repositories/${repositoryId}/security-overview`,
    );
  }

  sync(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    return this.api.post(
      `/organizations/${organizationId}/projects/${projectId}/repositories/${repositoryId}/sync`,
      {},
    );
  }

  archive(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    return this.api.post<RepositoryListItem>(
      `/organizations/${organizationId}/projects/${projectId}/repositories/${repositoryId}/archive`,
      {},
    );
  }

  restore(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    return this.api.post<RepositoryListItem>(
      `/organizations/${organizationId}/projects/${projectId}/repositories/${repositoryId}/restore`,
      {},
    );
  }

  remove(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    return this.api.delete<{
      message: string;
    }>(
      `/organizations/${organizationId}/projects/${projectId}/repositories/${repositoryId}`,
    );
  }
}
