import {
  Organization,
  OrganizationMember,
  Role,
  User,
} from '@prisma/client';

export type OrganizationMemberWithRelations =
  OrganizationMember & {
    user: Omit<User, 'passwordHash'>;
    role: Role;
  };

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;

  createdAt: Date;
  updatedAt: Date;

  membersCount?: number;
  projectsCount?: number;

  members?: OrganizationMemberWithRelations[];
}
