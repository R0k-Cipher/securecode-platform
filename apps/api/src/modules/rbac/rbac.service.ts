import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import {
  PrismaService,
} from '@securecode-platform/database';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async getUserPermissions(
    organizationId:
      string,

    userId:
      string,
  ): Promise<string[]> {
    let member =
      await this.prisma
        .organizationMember
        .findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId,
            },
          },

          include: {
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
        });

    /*
     * Sécurité / cohérence :
     *
     * Le créateur d'une organisation doit
     * toujours être OWNER.
     *
     * Si une ancienne organisation existe
     * sans membership correct, on répare
     * automatiquement l'incohérence.
     */
    if (!member) {
      const organization =
        await this.prisma
          .organization
          .findFirst({
            where: {
              id:
                organizationId,

              createdById:
                userId,
            },

            select: {
              id:
                true,
            },
          });

      if (organization) {
        const ownerRole =
          await this.prisma
            .role
            .findUnique({
              where: {
                code:
                  'OWNER',
              },

              select: {
                id:
                  true,
              },
            });

        if (!ownerRole) {
          throw new InternalServerErrorException(
            'Le rôle système OWNER est introuvable.',
          );
        }

        await this.prisma
          .organizationMember
          .upsert({
            where: {
              organizationId_userId: {
                organizationId,
                userId,
              },
            },

            create: {
              organizationId,
              userId,

              roleId:
                ownerRole.id,

              joinedAt:
                new Date(),
            },

            update: {
              roleId:
                ownerRole.id,
            },
          });

        member =
          await this.prisma
            .organizationMember
            .findUnique({
              where: {
                organizationId_userId: {
                  organizationId,
                  userId,
                },
              },

              include: {
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
            });
      }
    }

    if (!member) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de cette organisation.",
      );
    }

    return member.role
      .permissions
      .map(
        (
          rolePermission,
        ) =>
          rolePermission
            .permission
            .code,
      );
  }

  async hasPermission(
    organizationId:
      string,

    userId:
      string,

    permission:
      string,
  ): Promise<boolean> {
    const permissions =
      await this.getUserPermissions(
        organizationId,
        userId,
      );

    return permissions.includes(
      permission,
    );
  }

  async requirePermission(
    organizationId:
      string,

    userId:
      string,

    permission:
      string,
  ): Promise<void> {
    const allowed =
      await this.hasPermission(
        organizationId,
        userId,
        permission,
      );

    if (!allowed) {
      throw new ForbiddenException(
        'Permission insuffisante.',
      );
    }
  }
}
