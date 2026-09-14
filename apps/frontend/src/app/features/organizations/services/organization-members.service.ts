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
  scope?: 'ORGANIZATION' | 'PROJECT';
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

export interface InvitationProjectAssignment {
  id?: string;

  projectId: string;

  project?: {
    id: string;
    name: string;
    slug?: string;
  };

  role: {
    id?: string;
    code: string;
    name: string;
  };
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;

  role: OrganizationRole;

  projectAssignments?:
    InvitationProjectAssignment[];

  invitedBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export interface InvitationProjectPayload {
  projectId: string;
  roleCode: string;
}

export interface InviteOrganizationMemberPayload {
  email: string;

  firstName: string;

  lastName: string;

  roleId?: string;

  organizationRoleCode?:
    'MEMBER' | 'ADMIN';

  projects?:
    InvitationProjectPayload[];
}

export interface OrganizationProjectOption {
  id: string;
  name: string;
  slug?: string;
  status?: string;
}

export interface ProjectRoleOption {
  code: string;
  name: string;
}

@Injectable({
  providedIn:
    'root',
})
export class OrganizationMembersService {

  private readonly api =
    inject(
      ApiClientService,
    );

  members(
    organizationId:
      string,
  ) {
    return this.api.get<{
      data:
        OrganizationMember[];

      total:
        number;
    }>(
      `/organizations/${organizationId}/members`,
    );
  }

  invitations(
    organizationId:
      string,
  ) {
    return this.api.get<{
      data:
        OrganizationInvitation[];

      total:
        number;
    }>(
      `/organizations/${organizationId}/invitations`,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Invitation finale
  |--------------------------------------------------------------------------
  |
  | On accepte maintenant le payload complet.
  |--------------------------------------------------------------------------
  */

  invite(
    organizationId:
      string,

    payload:
      InviteOrganizationMemberPayload,
  ) {
    return this.api.post<{
      message:
        string;

      delivery?: {
        emailSent:
          boolean;
      };

      invitationToken?:
        string;
    }>(
      `/organizations/${organizationId}/members/invite`,
      payload,
    );
  }

  updateRole(
    organizationId:
      string,

    memberId:
      string,

    roleId:
      string,
  ) {
    return this.api.patch(
      `/organizations/${organizationId}/members/${memberId}`,
      {
        roleId,
      },
    );
  }

  remove(
    organizationId:
      string,

    memberId:
      string,
  ) {
    return this.api.delete(
      `/organizations/${organizationId}/members/${memberId}`,
    );
  }

  cancelInvitation(
    organizationId:
      string,

    invitationId:
      string,
  ) {
    return this.api.delete(
      `/organizations/${organizationId}/invitations/${invitationId}`,
    );
  }
}
