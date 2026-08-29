import {
  Injectable,
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
    private readonly prisma:
      PrismaService,
  ) {}

  async create(
    input: {
      organizationId?: string | null;
      projectId?: string | null;
      actorId?: string | null;

      action:
        AuditAction;

      resourceType:
        string;

      resourceId?:
        string | null;

      description?:
        string | null;

      ipAddress?:
        string | null;

      userAgent?:
        string | null;

      metadata?:
        Prisma.InputJsonValue;
    },
  ) {
    let ipAddress =
      input.ipAddress ??
      null;

    let userAgent =
      input.userAgent ??
      null;

    /*
     * Fallback :
     * si le controller/service ne fournit pas l'IP,
     * on récupère les informations de la dernière session.
     */
    if (
      input.actorId &&
      (!ipAddress ||
        !userAgent)
    ) {
      const session =
        await this.prisma.session
          .findFirst({
            where: {
              userId:
                input.actorId,
            },

            orderBy: {
              createdAt:
                'desc',
            },

            select: {
              ipAddress:
                true,

              userAgent:
                true,
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

    return this.prisma.auditLog
      .create({
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

  getOrganizationLogs(
    organizationId: string,
    options?: {
      take?: number;
    },
  ) {
    return this.prisma.auditLog
      .findMany({
        where: {
          organizationId,
        },

        orderBy: {
          createdAt:
            'desc',
        },

        take:
          Math.min(
            options?.take ??
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

  getPlatformLogs(
    options?: {
      take?: number;
    },
  ) {
    return this.prisma.auditLog
      .findMany({
        orderBy: {
          createdAt:
            'desc',
        },

        take:
          Math.min(
            options?.take ??
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

          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
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
}
