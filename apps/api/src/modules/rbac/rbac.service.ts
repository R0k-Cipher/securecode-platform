import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  PrismaService,
} from '@securecode-platform/database';

import type {
  PermissionCode,
} from './types/permission-code.type';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Organization membership
  |--------------------------------------------------------------------------
  */

  async getOrganizationMembership(
    organizationId: string,
    userId: string,
  ) {
    const membership =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },

        select: {
          id: true,
          organizationId: true,
          userId: true,
          roleId: true,

          role: {
            select: {
              id: true,
              code: true,
              name: true,
              scope: true,

              permissions: {
                select: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de cette organisation.",
      );
    }

    if (
      membership.role.scope !==
      'ORGANIZATION'
    ) {
      throw new ForbiddenException(
        "Le rôle affecté au membre n'est pas un rôle d'organisation valide.",
      );
    }

    return membership;
  }

  /*
  |--------------------------------------------------------------------------
  | Organization permissions
  |--------------------------------------------------------------------------
  */

  async getOrganizationPermissions(
    organizationId: string,
    userId: string,
  ): Promise<PermissionCode[]> {
    const membership =
      await this.getOrganizationMembership(
        organizationId,
        userId,
      );

    return membership.role.permissions.map(
      (rolePermission) =>
        rolePermission.permission.code as PermissionCode,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Project membership
  |--------------------------------------------------------------------------
  */

  async getProjectMembership(
    organizationId: string,
    projectId: string,
    userId: string,
  ) {
    /*
     * Le user doit d'abord appartenir à l'organisation.
     */

    const organizationMembership =
      await this.getOrganizationMembership(
        organizationId,
        userId,
      );

    /*
     * Le projet doit appartenir exactement
     * à l'organisation du contexte JWT/route.
     */

    const project =
      await this.prisma.project.findFirst({
        where: {
          id: projectId,
          organizationId,
        },

        select: {
          id: true,
          organizationId: true,
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable.',
      );
    }

    /*
     * OWNER possède un accès global
     * sur tous les projets de SON organisation.
     */

    if (
      organizationMembership.role.code ===
      'OWNER'
    ) {
      return {
        isOwner: true as const,

        organizationMembership,

        project,

        projectMembership: null,
      };
    }

    /*
     * Tous les autres users doivent avoir
     * un ProjectMember explicite.
     */

    const projectMembership =
      await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
        },

        select: {
          id: true,
          projectId: true,
          userId: true,
          roleId: true,

          role: {
            select: {
              id: true,
              code: true,
              name: true,
              scope: true,

              permissions: {
                select: {
                  permission: {
                    select: {
                      code: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    if (!projectMembership) {
      throw new ForbiddenException(
        "Vous n'êtes pas affecté à ce projet.",
      );
    }

    if (
      projectMembership.role.scope !==
      'PROJECT'
    ) {
      throw new ForbiddenException(
        "Le rôle affecté à ce membre n'est pas un rôle projet valide.",
      );
    }

    return {
      isOwner: false as const,

      organizationMembership,

      project,

      projectMembership,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Project permissions
  |--------------------------------------------------------------------------
  */

  async getProjectPermissions(
    organizationId: string,
    projectId: string,
    userId: string,
  ): Promise<PermissionCode[]> {
    const context =
      await this.getProjectMembership(
        organizationId,
        projectId,
        userId,
      );

    /*
     * OWNER = permissions complètes
     * de son rôle organisation.
     */

    if (context.isOwner) {
      return context.organizationMembership.role.permissions.map(
        (rolePermission) =>
          rolePermission.permission.code as PermissionCode,
      );
    }

    return context.projectMembership.role.permissions.map(
      (rolePermission) =>
        rolePermission.permission.code as PermissionCode,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Organization permission checks
  |--------------------------------------------------------------------------
  */

  async hasOrganizationPermission(
    organizationId: string,
    userId: string,
    permission: PermissionCode,
  ): Promise<boolean> {
    const permissions =
      await this.getOrganizationPermissions(
        organizationId,
        userId,
      );

    return permissions.includes(
      permission,
    );
  }

  async requireOrganizationPermission(
    organizationId: string,
    userId: string,
    permission: PermissionCode,
  ): Promise<void> {
    const allowed =
      await this.hasOrganizationPermission(
        organizationId,
        userId,
        permission,
      );

    if (!allowed) {
      throw new ForbiddenException(
        `Permission requise : ${permission}`,
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Project permission checks
  |--------------------------------------------------------------------------
  */

  async hasProjectPermission(
    organizationId: string,
    projectId: string,
    userId: string,
    permission: PermissionCode,
  ): Promise<boolean> {
    const permissions =
      await this.getProjectPermissions(
        organizationId,
        projectId,
        userId,
      );

    return permissions.includes(
      permission,
    );
  }

  async requireProjectPermission(
    organizationId: string,
    projectId: string,
    userId: string,
    permission: PermissionCode,
  ): Promise<void> {
    const allowed =
      await this.hasProjectPermission(
        organizationId,
        projectId,
        userId,
        permission,
      );

    if (!allowed) {
      throw new ForbiddenException(
        `Permission requise : ${permission}`,
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Compatibility
  |--------------------------------------------------------------------------
  |
  | Gardé pour les services existants qui utilisent encore
  | getUserPermissions().
  |
  | ATTENTION :
  | cette méthode est ORGANIZATION uniquement.
  |
  */

  async getUserPermissions(
    organizationId: string,
    userId: string,
  ): Promise<PermissionCode[]> {
    return this.getOrganizationPermissions(
      organizationId,
      userId,
    );
  }

  async hasPermission(
    organizationId: string,
    userId: string,
    permission: PermissionCode,
  ): Promise<boolean> {
    return this.hasOrganizationPermission(
      organizationId,
      userId,
      permission,
    );
  }

  async requirePermission(
    organizationId: string,
    userId: string,
    permission: PermissionCode,
  ): Promise<void> {
    return this.requireOrganizationPermission(
      organizationId,
      userId,
      permission,
    );
  }
}
