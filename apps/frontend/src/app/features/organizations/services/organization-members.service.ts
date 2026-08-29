import {
  Injectable,
  inject,
} from '@angular/core';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

export interface OrganizationRole {
  id: string;
  code: string;
  name: string;
}

export interface OrganizationMember {
  id: string;
  joinedAt: string | null;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    lastLoginAt: string | null;
  };
  role: OrganizationRole;
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  role: OrganizationRole;
  invitedBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

@Injectable({
  providedIn: 'root',
})
export class OrganizationMembersService {
  private readonly api =
    inject(
      ApiClientService,
    );

  members(
    organizationId: string,
  ) {
    return this.api.get<{
      data: OrganizationMember[];
      total: number;
    }>(
      `/organizations/${organizationId}/members`,
    );
  }

  invitations(
    organizationId: string,
  ) {
    return this.api.get<{
      data: OrganizationInvitation[];
      total: number;
    }>(
      `/organizations/${organizationId}/invitations`,
    );
  }

  invite(
    organizationId: string,
    email: string,
    roleId: string,
  ) {
    return this.api.post<{
      message: string;
      delivery?: {
        emailSent: boolean;
      };
      invitationToken?: string;
    }>(
      `/organizations/${organizationId}/members/invite`,
      {
        email,
        roleId,
      },
    );
  }

  updateRole(
    organizationId: string,
    memberId: string,
    roleId: string,
  ) {
    return this.api.patch(
      `/organizations/${organizationId}/members/${memberId}`,
      {
        roleId,
      },
    );
  }

  remove(
    organizationId: string,
    memberId: string,
  ) {
    return this.api.delete(
      `/organizations/${organizationId}/members/${memberId}`,
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
