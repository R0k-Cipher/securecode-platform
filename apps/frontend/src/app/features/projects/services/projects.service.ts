import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

import type {
  CreateProjectRequest,
  Project,
  ProjectListResponse,
  ProjectStatus,
  UpdateProjectRequest,
} from '../models/project.models';

@Injectable({
  providedIn:
    'root',
})
export class ProjectsService {
  private readonly api =
    inject(
      ApiClientService,
    );

  list(
    organizationId:
      string,

    options?: {
      page?:
        number;

      limit?:
        number;

      search?:
        string;

      status?:
        ProjectStatus;
    },
  ) {
    return this.api
      .get<ProjectListResponse>(
        `/organizations/${organizationId}/projects`,
        {
          page:
            options?.page ??
            1,

          limit:
            options?.limit ??
            20,

          search:
            options?.search,

          status:
            options?.status,
        },
      );
  }

  getOne(
    organizationId:
      string,

    projectId:
      string,
  ) {
    return this.api
      .get<Project>(
        `/organizations/${organizationId}/projects/${projectId}`,
      );
  }

  create(
    organizationId:
      string,

    request:
      CreateProjectRequest,
  ) {
    return this.api
      .post<Project>(
        `/organizations/${organizationId}/projects`,
        request,
      );
  }

  update(
    organizationId:
      string,

    projectId:
      string,

    request:
      UpdateProjectRequest,
  ) {
    return this.api
      .patch<Project>(
        `/organizations/${organizationId}/projects/${projectId}`,
        request,
      );
  }

  archive(
    organizationId:
      string,

    projectId:
      string,
  ) {
    return this.api
      .post<Project>(
        `/organizations/${organizationId}/projects/${projectId}/archive`,
      );
  }

  restore(
    organizationId:
      string,

    projectId:
      string,
  ) {
    return this.api
      .post<Project>(
        `/organizations/${organizationId}/projects/${projectId}/restore`,
      );
  }

  remove(
    organizationId:
      string,

    projectId:
      string,
  ) {
    return this.api
      .delete<{
        message:
          string;
      }>(
        `/organizations/${organizationId}/projects/${projectId}`,
      );
  }
}
