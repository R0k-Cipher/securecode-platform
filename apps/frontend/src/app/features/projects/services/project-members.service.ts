import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

export type ProjectRoleCode =
  | 'PROJECT_ADMIN'
  | 'MANAGER'
  | 'SECURITY_ANALYST'
  | 'DEVELOPER'
  | 'AUDITOR'
  | 'VIEWER';

export interface ProjectRole {
  id: string;
  code: ProjectRoleCode;
  name: string;
  description?: string | null;
  scope: 'PROJECT';

  permissions?: Array<{
    permission: {
      code: string;
      name: string;
      description?: string | null;
    };
  }>;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  roleId: string;
  createdAt: string;
  updatedAt: string;

  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    status: string;
  };

  role: ProjectRole;
}

export interface AddProjectMemberRequest {
  userId: string;
  roleCode: ProjectRoleCode;
}

export interface UpdateProjectMemberRoleRequest {
  roleCode: ProjectRoleCode;
}

@Injectable({
  providedIn:
    'root',
})
export class ProjectMembersService {
  private readonly api =
    inject(
      ApiClientService,
    );

  list(
    organizationId:
      string,

    projectId:
      string,
  ) {
    return this.api
      .get<ProjectMember[]>(
        `/organizations/${organizationId}/projects/${projectId}/members`,
      );
  }

  roles(
    organizationId:
      string,

    projectId:
      string,
  ) {
    return this.api
      .get<ProjectRole[]>(
        `/organizations/${organizationId}/projects/${projectId}/members/roles`,
      );
  }

  add(
    organizationId:
      string,

    projectId:
      string,

    request:
      AddProjectMemberRequest,
  ) {
    return this.api
      .post<ProjectMember>(
        `/organizations/${organizationId}/projects/${projectId}/members`,
        request,
      );
  }

  updateRole(
    organizationId:
      string,

    projectId:
      string,

    userId:
      string,

    request:
      UpdateProjectMemberRoleRequest,
  ) {
    return this.api
      .patch<ProjectMember>(
        `/organizations/${organizationId}/projects/${projectId}/members/${userId}/role`,
        request,
      );
  }

  remove(
    organizationId:
      string,

    projectId:
      string,

    userId:
      string,
  ) {
    return this.api
      .delete<{
        message:
          string;
      }>(
        `/organizations/${organizationId}/projects/${projectId}/members/${userId}`,
      );
  }
}
