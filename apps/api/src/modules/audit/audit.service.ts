import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditAction,
  Prisma,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    input: {
      organizationId?: string | null;
      projectId?: string | null;
      actorId?: string | null;

      action: AuditAction;

      resourceType: string;

      resourceId?: string | null;

      description?: string | null;

      ipAddress?: string | null;

      userAgent?: string | null;

      metadata?: Prisma.InputJsonValue;
    },
  ) {
    let ipAddress =
      input.ipAddress ??
      null;

    let userAgent =
      input.userAgent ??
      null;

    if (
      input.actorId &&
      (!ipAddress || !userAgent)
    ) {
      const session =
        await this.prisma.session.findFirst({
          where: {
            userId: input.actorId,
            revokedAt: null,
          },

          orderBy: {
            createdAt: 'desc',
          },

          select: {
            ipAddress: true,
            userAgent: true,
          },
        });

      ipAddress =
        ipAddress ??
        session?.ipAddress ??
        null;

      userAgent =
        userAgent ??
        session?.userAgent ??
        null;
    }

    return this.prisma.auditLog.create({
      data: {
        organizationId:
          input.organizationId ??
          null,

        projectId:
          input.projectId ??
          null,

        actorId:
          input.actorId ??
          null,

        action:
          input.action,

        resourceType:
          input.resourceType,

        resourceId:
          input.resourceId ??
          null,

        description:
          input.description ??
          null,

        ipAddress,

        userAgent,

        metadata:
          input.metadata,
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Platform logs
  |--------------------------------------------------------------------------
  |
  | IMPORTANT :
  | le Platform Admin ne doit jamais récupérer les logs internes
  | d'une organisation cliente.
  |
  | Les événements plateforme sont ceux qui n'ont ni organizationId
  | ni projectId.
  */

  getPlatformLogs(
    options?: {
      take?: number;
    },
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId: null,
        projectId: null,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take:
        this.normalizeTake(
          options?.take,
          500,
          1000,
        ),

      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Tous les logs d'une organisation
  |--------------------------------------------------------------------------
  |
  | Utilisé principalement pour OWNER.
  */

  getOrganizationLogs(
    organizationId: string,
    options?: {
      take?: number;
    },
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take:
        this.normalizeTake(
          options?.take,
          200,
          500,
        ),

      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },

        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Audit organisation selon l'utilisateur
  |--------------------------------------------------------------------------
  */

  async getOrganizationLogsForUser(
    organizationId: string,
    userId: string,
    options?: {
      take?: number;
    },
  ) {
    const organization =
      await this.prisma.organization.findUnique({
        where: {
          id: organizationId,
        },

        select: {
          id: true,
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Organisation introuvable.',
      );
    }

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

          role: {
            select: {
              code: true,
              scope: true,
            },
          },
        },
      });

    if (!membership) {
      return [];
    }

    if (
      membership.role.scope !==
      'ORGANIZATION'
    ) {
      return [];
    }

    /*
    |--------------------------------------------------------------------------
    | OWNER
    |--------------------------------------------------------------------------
    */

    if (
      membership.role.code ===
      'OWNER'
    ) {
      return this.getOrganizationLogs(
        organizationId,
        options,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ADMIN / autres membres disposant de audit-log:read
    |--------------------------------------------------------------------------
    |
    | Le PermissionsGuard vérifie déjà la permission.
    |
    | Ici on limite les données visibles :
    | - logs organisationnels ;
    | - logs des projets auxquels l'utilisateur appartient.
    */

    const projectMemberships =
      await this.prisma.projectMember.findMany({
        where: {
          userId,

          project: {
            organizationId,
          },
        },

        select: {
          projectId: true,
        },
      });

    const projectIds =
      projectMemberships.map(
        membership =>
          membership.projectId,
      );

    return this.prisma.auditLog.findMany({
      where: {
        organizationId,

        OR: [
          {
            projectId: null,
          },

          ...(projectIds.length > 0
            ? [
                {
                  projectId: {
                    in: projectIds,
                  },
                },
              ]
            : []),
        ],
      },

      orderBy: {
        createdAt: 'desc',
      },

      take:
        this.normalizeTake(
          options?.take,
          200,
          500,
        ),

      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },

        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Audit d'un projet
  |--------------------------------------------------------------------------
  */

  async getProjectLogsForUser(
    organizationId: string,
    projectId: string,
    userId: string,
    options?: {
      take?: number;
    },
  ) {
    const project =
      await this.prisma.project.findFirst({
        where: {
          id: projectId,
          organizationId,
        },

        select: {
          id: true,
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable.',
      );
    }

    const organizationMembership =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },

        select: {
          id: true,

          role: {
            select: {
              code: true,
              scope: true,
            },
          },
        },
      });

    if (!organizationMembership) {
      return [];
    }

    if (
      organizationMembership.role.scope !==
      'ORGANIZATION'
    ) {
      return [];
    }

    /*
    |--------------------------------------------------------------------------
    | OWNER bypass
    |--------------------------------------------------------------------------
    */

    if (
      organizationMembership.role.code !==
      'OWNER'
    ) {
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

            role: {
              select: {
                scope: true,
              },
            },
          },
        });

      if (
        !projectMembership ||
        projectMembership.role.scope !==
          'PROJECT'
      ) {
        return [];
      }
    }

    return this.prisma.auditLog.findMany({
      where: {
        organizationId,
        projectId,
      },

      orderBy: {
        createdAt: 'desc',
      },

      take:
        this.normalizeTake(
          options?.take,
          200,
          500,
        ),

      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },

        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  private normalizeTake(
    value: number | undefined,
    defaultValue: number,
    maximum: number,
  ): number {
    if (
      value === undefined ||
      !Number.isFinite(value)
    ) {
      return defaultValue;
    }

    return Math.min(
      Math.max(
        Math.trunc(value),
        1,
      ),
      maximum,
    );
  }
}
