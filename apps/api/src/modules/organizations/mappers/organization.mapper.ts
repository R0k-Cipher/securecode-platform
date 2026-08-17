import {
  Organization,
  OrganizationMember,
  Project,
  Role,
  User,
} from '@prisma/client';

import {
  OrganizationMemberWithRelations,
  OrganizationResponse,
} from '../types/organization-response.type';

export class OrganizationMapper {
  static toResponse(
    organization: Organization,
  ): OrganizationResponse {
    return {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      description: organization.description,
      logoUrl: organization.logoUrl,

      createdAt: organization.createdAt,
      updatedAt: organization.updatedAt,
    };
  }

  static withMembers(
    organization: Organization & {
      members: (OrganizationMember & {
        user: Omit<User, 'passwordHash'>;
        role: Role;
      })[];
    },
  ): OrganizationResponse {
    return {
      ...this.toResponse(organization),

      members: organization.members,

      membersCount: organization.members.length,
    };
  }

  static withStatistics(
    organization: Organization & {
      _count: {
        members: number;
        projects: number;
      };
    },
  ): OrganizationResponse {
    return {
      ...this.toResponse(organization),

      membersCount: organization._count.members,

      projectsCount: organization._count.projects,
    };
  }
}
