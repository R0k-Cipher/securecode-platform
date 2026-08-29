import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

import type {
  CreateOrganizationRequest,
  Organization,
  OrganizationListResponse,
} from '../models/organization.models';

@Injectable({
  providedIn:
    'root',
})
export class OrganizationsService {
  private readonly api =
    inject(
      ApiClientService,
    );

  listMine(
    options?: {
      page?:
        number;

      limit?:
        number;

      search?:
        string;
    },
  ) {
    return this.api
      .get<
        OrganizationListResponse
      >(
        '/organizations',
        {
          page:
            options?.page ??
            1,

          limit:
            options?.limit ??
            20,

          search:
            options
              ?.search,
        },
      );
  }

  getOne(
    organizationId:
      string,
  ) {
    return this.api
      .get<Organization>(
        `/organizations/${organizationId}`,
      );
  }

  create(
    request:
      CreateOrganizationRequest,
  ) {
    return this.api
      .post<Organization>(
        '/organizations',
        request,
      );
  }

  getMembers(
    organizationId: string,
  ) {
    return this.api.get<any>(
      `/organizations/${organizationId}/members`,
    );
  }

  inviteMember(
    organizationId: string,
    request: {
      email: string;
      roleCode: string;
    },
  ) {
    return this.api.post(
      `/organizations/${organizationId}/members/invite`,
      request,
    );
  }

  updateMemberRole(
    organizationId: string,
    memberId: string,
    roleCode: string,
  ) {
    return this.api.patch(
      `/organizations/${organizationId}/members/${memberId}`,
      {
        roleCode,
      },
    );
  }

  removeMember(
    organizationId: string,
    memberId: string,
  ) {
    return this.api.delete(
      `/organizations/${organizationId}/members/${memberId}`,
    );
  }

  getInvitations(
    organizationId: string,
  ) {
    return this.api.get<any>(
      `/organizations/${organizationId}/invitations`,
    );
  }

  cancelInvitation(
    organizationId: string,
    invitationId: string,
  ) {
    return this.api.delete(
      `/organizations/${organizationId}/invitations/${invitationId}`,
    );
  }
}
