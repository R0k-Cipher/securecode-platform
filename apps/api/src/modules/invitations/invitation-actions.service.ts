import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditAction,
  NotificationType,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

@Injectable()
export class InvitationActionsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async accept(
    userId:
      string,

    invitationId:
      string,
  ) {
    const invitation =
      await this.prisma.invitation.findUnique({
        where: {
          id:
            invitationId,
        },

        include: {
          organization: {
            select: {
              id:
                true,

              name:
                true,

              slug:
                true,
            },
          },

          role: {
            select: {
              id:
                true,

              code:
                true,

              name:
                true,

              scope:
                true,
            },
          },

          projectAssignments: {
            include: {
              project: {
                select: {
                  id:
                    true,

                  organizationId:
                    true,

                  name:
                    true,

                  slug:
                    true,
                },
              },

              role: {
                select: {
                  id:
                    true,

                  code:
                    true,

                  name:
                    true,

                  scope:
                    true,
                },
              },
            },
          },
        },
      });

    if (!invitation) {
      throw new NotFoundException(
        'Invitation introuvable.',
      );
    }

    if (
      invitation.acceptedAt
    ) {
      throw new ConflictException(
        'Invitation déjà acceptée.',
      );
    }

    if (
      invitation.revokedAt
    ) {
      throw new BadRequestException(
        'Invitation révoquée.',
      );
    }

    if (
      invitation.expiresAt <=
      new Date()
    ) {
      throw new BadRequestException(
        'Invitation expirée.',
      );
    }

    if (
      invitation.role.scope !==
      'ORGANIZATION'
    ) {
      throw new ForbiddenException(
        'Le rôle de cette invitation n’est pas un rôle organisation valide.',
      );
    }

    for (
      const assignment of
      invitation.projectAssignments
    ) {
      if (
        assignment.project.organizationId !==
        invitation.organizationId
      ) {
        throw new ForbiddenException(
          'Une affectation projet appartient à une autre organisation.',
        );
      }

      if (
        assignment.role.scope !==
        'PROJECT'
      ) {
        throw new ForbiddenException(
          'Une affectation contient un rôle projet invalide.',
        );
      }
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          id:
            true,

          email:
            true,

          status:
            true,

          platformRole:
            true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'Utilisateur introuvable.',
      );
    }

    if (
      user.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      throw new ForbiddenException(
        'Un administrateur plateforme ne peut pas rejoindre une organisation cliente.',
      );
    }

    if (
      user.status ===
        'DISABLED' ||
      user.status ===
        'SUSPENDED'
    ) {
      throw new ForbiddenException(
        'Ce compte est désactivé ou suspendu.',
      );
    }

    if (
      user.email
        .trim()
        .toLowerCase() !==
      invitation.email
        .trim()
        .toLowerCase()
    ) {
      throw new ForbiddenException(
        "Cette invitation n'appartient pas à votre compte.",
      );
    }

    const now =
      new Date();

    const result =
      await this.prisma.$transaction(
        async transaction => {
          const identity =
            await transaction.organizationIdentity.findUnique({
              where: {
                organizationId_userId: {
                  organizationId:
                    invitation.organizationId,

                  userId,
                },
              },
            });

          if (!identity) {
            throw new ConflictException(
              'Identité organisation introuvable pour cette invitation.',
            );
          }

          /*
           * Le legacy accept ne définit pas un nouveau mot de passe.
           * L'identité doit donc déjà posséder les credentials temporaires
           * générés lors de l'invitation.
           */
          if (
            !identity.passwordHash
          ) {
            throw new ConflictException(
              'Cette identité ne possède pas encore de credentials valides. Utilisez le lien d’activation reçu par email.',
            );
          }

          if (
            identity.temporaryPasswordExpiresAt &&
            identity.temporaryPasswordExpiresAt <=
              now
          ) {
            throw new BadRequestException(
              'Les credentials temporaires ont expiré.',
            );
          }

          const existing =
            await transaction.organizationMember.findUnique({
              where: {
                organizationId_userId: {
                  organizationId:
                    invitation.organizationId,

                  userId,
                },
              },
            });

          const member =
            existing
              ? await transaction.organizationMember.update({
                  where: {
                    id:
                      existing.id,
                  },

                  data: {
                    roleId:
                      invitation.roleId,

                    invitedById:
                      invitation.invitedById,

                    joinedAt:
                      now,
                  },
                })
              : await transaction.organizationMember.create({
                  data: {
                    organizationId:
                      invitation.organizationId,

                    userId,

                    roleId:
                      invitation.roleId,

                    invitedById:
                      invitation.invitedById,

                    joinedAt:
                      now,
                  },
                });

          for (
            const assignment of
            invitation.projectAssignments
          ) {
            await transaction.projectMember.upsert({
              where: {
                projectId_userId: {
                  projectId:
                    assignment.projectId,

                  userId,
                },
              },

              create: {
                projectId:
                  assignment.projectId,

                userId,

                roleId:
                  assignment.roleId,
              },

              update: {
                roleId:
                  assignment.roleId,
              },
            });
          }

          await transaction.organizationIdentity.update({
            where: {
              id:
                identity.id,
            },

            data: {
              status:
                'ACTIVE',

              /*
               * On garde mustChangePassword=true ici.
               * L'utilisateur a accepté via une session existante
               * mais n'a pas encore choisi son mot de passe
               * pour cette identité.
               */
              mustChangePassword:
                true,

              activatedAt:
                now,
            },
          });

          if (
            user.status !==
            'ACTIVE'
          ) {
            await transaction.user.update({
              where: {
                id:
                  userId,
              },

              data: {
                status:
                  'ACTIVE',
              },
            });
          }

          await transaction.invitation.update({
            where: {
              id:
                invitation.id,
            },

            data: {
              acceptedAt:
                now,
            },
          });

          const notifications =
            await transaction.notification.findMany({
              where: {
                userId,

                type:
                  NotificationType.INVITATION,

                readAt:
                  null,
              },

              select: {
                id:
                  true,

                metadata:
                  true,
              },
            });

          const ids =
            notifications
              .filter(
                notification =>
                  (
                    notification.metadata as
                      Record<
                        string,
                        unknown
                      > |
                      null
                  )?.[
                    'invitationId'
                  ] ===
                  invitation.id,
              )
              .map(
                notification =>
                  notification.id,
              );

          if (
            ids.length >
            0
          ) {
            await transaction.notification.updateMany({
              where: {
                id: {
                  in:
                    ids,
                },
              },

              data: {
                readAt:
                  now,
              },
            });
          }

          await transaction.auditLog.create({
            data: {
              organizationId:
                invitation.organizationId,

              actorId:
                userId,

              action:
                AuditAction.ACCEPT_INVITATION,

              resourceType:
                'Invitation',

              resourceId:
                invitation.id,

              description:
                `${user.email} a accepté l'invitation`,

              metadata: {
                organizationRoleCode:
                  invitation.role.code,

                legacySessionAcceptance:
                  true,

                projectAssignments:
                  invitation.projectAssignments.map(
                    assignment => ({
                      projectId:
                        assignment.projectId,

                      roleCode:
                        assignment.role.code,
                    }),
                  ),
              },
            },
          });

          return member;
        },
      );

    return {
      success:
        true,

      member:
        result,

      organization:
        invitation.organization,

      role:
        invitation.role,

      projects:
        invitation.projectAssignments.map(
          assignment => ({
            project:
              assignment.project,

            role:
              assignment.role,
          }),
        ),
    };
  }

  async decline(
    userId:
      string,

    invitationId:
      string,
  ) {
    const invitation =
      await this.prisma.invitation.findUnique({
        where: {
          id:
            invitationId,
        },

        include: {
          organization: {
            select: {
              id:
                true,

              name:
                true,
            },
          },
        },
      });

    if (!invitation) {
      throw new NotFoundException(
        'Invitation introuvable.',
      );
    }

    if (
      invitation.acceptedAt
    ) {
      throw new BadRequestException(
        'Invitation déjà acceptée.',
      );
    }

    if (
      invitation.revokedAt
    ) {
      return {
        success:
          true,
      };
    }

    if (
      invitation.expiresAt <=
      new Date()
    ) {
      throw new BadRequestException(
        'Invitation expirée.',
      );
    }

    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            userId,
        },

        select: {
          email:
            true,
        },
      });

    if (!user) {
      throw new NotFoundException(
        'Utilisateur introuvable.',
      );
    }

    if (
      user.email
        .trim()
        .toLowerCase() !==
      invitation.email
        .trim()
        .toLowerCase()
    ) {
      throw new ForbiddenException(
        "Cette invitation n'appartient pas à votre compte.",
      );
    }

    const now =
      new Date();

    await this.prisma.$transaction(
      async transaction => {
        await transaction.invitation.update({
          where: {
            id:
              invitation.id,
          },

          data: {
            revokedAt:
              now,
          },
        });

        /*
         * On ne supprime pas le User global.
         * On désactive seulement l'identité INVITED
         * de cette organisation.
         */
        const invitedIdentity =
          await transaction.organizationIdentity.findFirst({
            where: {
              organizationId:
                invitation.organizationId,

              user: {
                email:
                  invitation.email,
              },

              status:
                'INVITED',
            },

            select: {
              id:
                true,
            },
          });

        if (
          invitedIdentity
        ) {
          await transaction.organizationIdentity.update({
            where: {
              id:
                invitedIdentity.id,
            },

            data: {
              status:
                'DISABLED',

              passwordHash:
                null,

              mustChangePassword:
                false,

              temporaryPasswordExpiresAt:
                null,
            },
          });
        }

        const notifications =
          await transaction.notification.findMany({
            where: {
              userId,

              type:
                NotificationType.INVITATION,

              readAt:
                null,
            },

            select: {
              id:
                true,

              metadata:
                true,
            },
          });

        const ids =
          notifications
            .filter(
              notification =>
                (
                  notification.metadata as
                    Record<
                      string,
                      unknown
                    > |
                    null
                )?.[
                  'invitationId'
                ] ===
                invitation.id,
            )
            .map(
              notification =>
                notification.id,
            );

        if (
          ids.length >
          0
        ) {
          await transaction.notification.updateMany({
            where: {
              id: {
                in:
                  ids,
              },
            },

            data: {
              readAt:
                now,
            },
          });
        }

        await transaction.auditLog.create({
          data: {
            organizationId:
              invitation.organizationId,

            actorId:
              userId,

            action:
              AuditAction.UPDATE,

            resourceType:
              'Invitation',

            resourceId:
              invitation.id,

            description:
              `${user.email} a refusé l'invitation`,

            metadata: {
              invitationStatus:
                'DECLINED',
            },
          },
        });
      },
    );

    return {
      success:
        true,
    };
  }
}
