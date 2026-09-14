import {
  Injectable,
} from '@nestjs/common';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  RbacService,
} from '../rbac/rbac.service';

@Injectable()
export class AuthContextService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly rbac:
      RbacService,
  ) {}

  async getContext(
    userId: string,
    organizationId:
      string | null,
    platformRole:
      string,
  ) {
    /*
    |--------------------------------------------------------------------------
    | Platform admin
    |--------------------------------------------------------------------------
    */

    if (
      platformRole ===
      'PLATFORM_ADMIN'
    ) {
      return {
        contextType:
          'PLATFORM',

        platformRole:
          'PLATFORM_ADMIN',

        organization:
          null,

        organizationRole:
          null,

        organizationPermissions:
          [],

        projects:
          [],

        capabilities: {
          platformAdmin:
            true,

          customerContext:
            false,
        },
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Aucun tenant dans la session
    |--------------------------------------------------------------------------
    */

    if (!organizationId) {
      return {
        contextType:
          'NONE',

        platformRole:
          'USER',

        organization:
          null,

        organizationRole:
          null,

        organizationPermissions:
          [],

        projects:
          [],

        capabilities: {
          platformAdmin:
            false,

          customerContext:
            false,
        },
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Membership organisation
    |--------------------------------------------------------------------------
    */

    const organizationMembership =
      await this.rbac.getOrganizationMembership(
        organizationId,
        userId,
      );

    const organizationPermissions =
      organizationMembership.role.permissions.map(
        (
          rolePermission,
        ) =>
          rolePermission.permission.code,
      );

    const organization =
      await this.prisma.organization.findUnique({
        where: {
          id:
            organizationId,
        },

        select: {
          id:
            true,

          name:
            true,

          slug:
            true,

          logoUrl:
            true,
        },
      });

    /*
    |--------------------------------------------------------------------------
    | OWNER
    |--------------------------------------------------------------------------
    |
    | OWNER voit tous les projets.
    |--------------------------------------------------------------------------
    */

    const isOwner =
      organizationMembership.role.code ===
      'OWNER';

    const projects =
      await this.prisma.project.findMany({
        where: {
          organizationId,

          ...(isOwner
            ? {}
            : {
                members: {
                  some: {
                    userId,
                  },
                },
              }),
        },

        orderBy: {
          name:
            'asc',
        },

        select: {
          id:
            true,

          name:
            true,

          slug:
            true,

          status:
            true,

          members: {
            where: {
              userId,
            },

            take:
              1,

            select: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission:
                        true,
                    },
                  },
                },
              },
            },
          },
        },
      });

    const projectContexts =
      projects.map(
        (
          project,
        ) => {
          /*
          |--------------------------------------------------------------------------
          | OWNER = permissions du rôle OWNER
          |--------------------------------------------------------------------------
          */

          if (isOwner) {
            const permissions =
              organizationPermissions;

            return {
              id:
                project.id,

              name:
                project.name,

              slug:
                project.slug,

              status:
                project.status,

              role: {
                code:
                  'OWNER',

                name:
                  organizationMembership
                    .role.name,

                scope:
                  'ORGANIZATION',
              },

              permissions,

              capabilities:
                this.buildCapabilities(
                  permissions,
                ),

              ownerOverride:
                true,
            };
          }

          const membership =
            project.members[0];

          if (!membership) {
            return null;
          }

          const permissions =
            membership.role.permissions.map(
              (
                rolePermission,
              ) =>
                rolePermission
                  .permission
                  .code,
            );

          return {
            id:
              project.id,

            name:
              project.name,

            slug:
              project.slug,

            status:
              project.status,

            role: {
              code:
                membership.role.code,

              name:
                membership.role.name,

              scope:
                membership.role.scope,
            },

            permissions,

            capabilities:
              this.buildCapabilities(
                permissions,
              ),

            ownerOverride:
              false,
          };
        },
      )
      .filter(
        (
          project,
        ) =>
          project !==
          null,
      );

    return {
      contextType:
        'ORGANIZATION',

      platformRole:
        'USER',

      organization,

      organizationRole: {
        code:
          organizationMembership
            .role.code,

        name:
          organizationMembership
            .role.name,

        scope:
          organizationMembership
            .role.scope,
      },

      organizationPermissions,

      organizationCapabilities:
        this.buildCapabilities(
          organizationPermissions,
        ),

      projects:
        projectContexts,

      capabilities: {
        platformAdmin:
          false,

        customerContext:
          true,

        owner:
          isOwner,
      },
    };
  }

  private buildCapabilities(
    permissions: string[],
  ) {
    const can =
      (
        permission:
          string,
      ) =>
        permissions.includes(
          permission,
        );

    return {
      organization: {
        read:
          can(
            'organization:read',
          ),

        update:
          can(
            'organization:update',
          ),

        delete:
          can(
            'organization:delete',
          ),
      },

      members: {
        read:
          can(
            'member:read',
          ),

        invite:
          can(
            'member:invite',
          ),

        update:
          can(
            'member:update',
          ),

        delete:
          can(
            'member:delete',
          ),
      },

      projects: {
        list:
          can(
            'project:list',
          ),

        create:
          can(
            'project:create',
          ),

        read:
          can(
            'project:read',
          ),

        update:
          can(
            'project:update',
          ),

        delete:
          can(
            'project:delete',
          ),

        archive:
          can(
            'project:archive',
          ),

        restore:
          can(
            'project:restore',
          ),
      },

      projectMembers: {
        read:
          can(
            'project-member:read',
          ),

        manage:
          can(
            'project-member:manage',
          ),
      },

      repositories: {
        create:
          can(
            'repository:create',
          ),

        read:
          can(
            'repository:read',
          ),

        update:
          can(
            'repository:update',
          ),

        delete:
          can(
            'repository:delete',
          ),

        sync:
          can(
            'repository:sync',
          ),
      },

      scans: {
        create:
          can(
            'scan:create',
          ),

        read:
          can(
            'scan:read',
          ),

        cancel:
          can(
            'scan:cancel',
          ),
      },

      findings: {
        read:
          can(
            'finding:read',
          ),

        update:
          can(
            'finding:update',
          ),

        assign:
          can(
            'finding:assign',
          ),
      },

      reports: {
        read:
          can(
            'report:read',
          ),

        export:
          can(
            'report:export',
          ),

        organizationRead:
          can(
            'organization-report:read',
          ),

        organizationExport:
          can(
            'organization-report:export',
          ),
      },

      audit: {
        read:
          can(
            'audit-log:read',
          ),
      },
    };
  }
}
