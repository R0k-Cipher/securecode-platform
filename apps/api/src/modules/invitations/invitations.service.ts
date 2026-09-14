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

import * as argon2 from 'argon2';

import {
  createHash,
} from 'node:crypto';

import {
  RegisterInvitedUserDto,
} from './dto/register-invited-user.dto';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async preview(
    token:
      string,
  ) {
    const invitation =
      await this.findValidInvitation(
        token,
      );

    const user =
      await this.prisma.user.findUnique({
        where: {
          email:
            invitation.email,
        },

        select: {
          id:
            true,

          firstName:
            true,

          lastName:
            true,

          status:
            true,
        },
      });

    const identity =
      user
        ? await this.prisma.organizationIdentity.findUnique({
            where: {
              organizationId_userId: {
                organizationId:
                  invitation.organizationId,

                userId:
                  user.id,
              },
            },

            select: {
              id:
                true,

              login:
                true,

              status:
                true,

              mustChangePassword:
                true,

              temporaryPasswordExpiresAt:
                true,
            },
          })
        : null;

    return {
      id:
        invitation.id,

      email:
        invitation.email,

      organization:
        invitation.organization,

      organizationRole:
        invitation.role,

      invitedBy:
        invitation.invitedBy,

      expiresAt:
        invitation.expiresAt,

      login:
        identity?.login ??
        null,

      identityStatus:
        identity?.status ??
        null,

      existingUser:
        Boolean(
          user,
        ),

      firstName:
        user?.firstName ??
        null,

      lastName:
        user?.lastName ??
        null,

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

  async registerInvitedUser(
    token:
      string,

    dto:
      RegisterInvitedUserDto,
  ) {
    const invitation =
      await this.findValidInvitation(
        token,
      );

    /*
     * Invitation organisation uniquement.
     */
    if (
      invitation.role.scope !==
      'ORGANIZATION'
    ) {
      throw new ForbiddenException(
        'Le rôle de cette invitation n’est pas un rôle organisation valide.',
      );
    }

    /*
     * OWNER n'est jamais attribué via une invitation standard.
     */
    if (
      ![
        'MEMBER',
        'ADMIN',
        'OWNER',
      ].includes(
        invitation.role.code,
      )
    ) {
      throw new ForbiddenException(
        'Le rôle organisation de cette invitation est invalide.',
      );
    }

    /*
     * Vérification anti-IDOR des affectations projet.
     */
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
          email:
            invitation.email,
        },

        select: {
          id:
            true,

          email:
            true,

          firstName:
            true,

          lastName:
            true,

          status:
            true,

          platformRole:
            true,
        },
      });

    /*
     * L'utilisateur et l'identité doivent être provisionnés
     * au moment de l'invitation.
     */
    if (!user) {
      throw new ConflictException(
        "Le compte associé à cette invitation est introuvable.",
      );
    }

    if (
      user.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      throw new ForbiddenException(
        'Un administrateur de la plateforme ne peut pas rejoindre une organisation cliente.',
      );
    }

    if (
      user.status ===
        'DISABLED' ||
      user.status ===
        'SUSPENDED'
    ) {
      throw new ForbiddenException(
        'Ce compte utilisateur est désactivé ou suspendu.',
      );
    }

    /*
     * Le mot de passe appartient à l'identité professionnelle,
     * pas au User global.
     */
    const passwordHash =
      await argon2.hash(
        dto.password,
        {
          type:
            argon2.argon2id,

          memoryCost:
            65_536,

          timeCost:
            3,

          parallelism:
            1,
        },
      );

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

                  userId:
                    user.id,
                },
              },

              select: {
                id:
                  true,

                login:
                  true,

                status:
                  true,

                passwordHash:
                  true,

                temporaryPasswordExpiresAt:
                  true,
              },
            });



          if (!identity) {
            throw new ConflictException(
              'L’identité organisation associée à cette invitation est introuvable.',
            );
          }

          if (
            identity.status ===
            'ACTIVE'
          ) {
            throw new ConflictException(
              'Cette identité organisation est déjà active.',
            );
          }

          if (
            !identity.passwordHash
          ) {
            throw new ConflictException(
              'Les informations temporaires de cette invitation sont indisponibles.',
            );
          }

          /*
           * Vérification finale expiration des credentials.
           */
          if (
            identity.temporaryPasswordExpiresAt &&
            identity.temporaryPasswordExpiresAt <=
              now
          ) {
            throw new BadRequestException(
              'Les informations temporaires de cette invitation ont expiré.',
            );
          }

          const temporaryPasswordIsValid =
            await argon2.verify(
              identity.passwordHash,
              dto.temporaryPassword,
            );

          if (
            !temporaryPasswordIsValid
          ) {
            throw new BadRequestException(
              'Le mot de passe temporaire est incorrect.',
            );
          }


          const existingMember =
            await transaction.organizationMember.findUnique({
              where: {
                organizationId_userId: {
                  organizationId:
                    invitation.organizationId,

                  userId:
                    user.id,
                },
              },

              select: {
                id:
                  true,
              },
            });

          /*
           * Le membre ne doit normalement pas exister avant activation.
           * Pour compatibilité avec les anciens tenants OWNER,
           * on réutilise le membership s'il existe déjà.
           */
          const member =
            existingMember
              ? await transaction.organizationMember.update({
                  where: {
                    id:
                      existingMember.id,
                  },

                  data: {
                    roleId:
                      invitation.roleId,

                    invitedById:
                      invitation.invitedById,

                    joinedAt:
                      now,
                  },

                  include: {
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
                  },
                })
              : await transaction.organizationMember.create({
                  data: {
                    organizationId:
                      invitation.organizationId,

                    userId:
                      user.id,

                    roleId:
                      invitation.roleId,

                    invitedById:
                      invitation.invitedById,

                    joinedAt:
                      now,
                  },

                  include: {
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
                  },
                });

          /*
           * Affectations projet exactes.
           */
          if (
            invitation.projectAssignments.length >
            0
          ) {
            for (
              const assignment of
              invitation.projectAssignments
            ) {
              await transaction.projectMember.upsert({
                where: {
                  projectId_userId: {
                    projectId:
                      assignment.projectId,

                    userId:
                      user.id,
                  },
                },

                create: {
                  projectId:
                    assignment.projectId,

                  userId:
                    user.id,

                  roleId:
                    assignment.roleId,
                },

                update: {
                  roleId:
                    assignment.roleId,
                },
              });
            }
          }

          const activatedIdentity =
            await transaction.organizationIdentity.update({
              where: {
                id:
                  identity.id,
              },

              data: {
                passwordHash,

                status:
                  'ACTIVE',

                mustChangePassword:
                  false,

                temporaryPasswordExpiresAt:
                  null,

                activatedAt:
                  now,
              },

              select: {
                id:
                  true,

                login:
                  true,

                status:
                  true,

                activatedAt:
                  true,
              },
            });

          /*
           * Le User global reste ACTIVE.
           */
          if (
            user.status !==
            'ACTIVE'
          ) {
            await transaction.user.update({
              where: {
                id:
                  user.id,
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

          /*
           * Fermer la notification invitation initiale.
           */
          const notifications =
            await transaction.notification.findMany({
              where: {
                userId:
                  user.id,

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

          const invitationNotificationIds =
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
            invitationNotificationIds.length >
            0
          ) {
            await transaction.notification.updateMany({
              where: {
                id: {
                  in:
                    invitationNotificationIds,
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
                user.id,

              action:
                AuditAction.ACCEPT_INVITATION,

              resourceType:
                'Invitation',

              resourceId:
                invitation.id,

              description:
                `${user.email} a accepté l’invitation et rejoint l’organisation.`,

              metadata: {
                organizationRoleCode:
                  invitation.role.code,

                identityId:
                  activatedIdentity.id,

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

          await transaction.notification.create({
            data: {
              userId:
                user.id,

              type:
                NotificationType.SYSTEM,

              title:
                `Bienvenue dans ${invitation.organization.name}`,

              message:
                `Vous avez rejoint ${invitation.organization.name} avec le rôle ${invitation.role.name}.`,

              metadata: {
                organizationId:
                  invitation.organizationId,

                organizationRoleCode:
                  invitation.role.code,
              },
            },
          });

          return {
            user: {
              id:
                user.id,

              email:
                user.email,

              firstName:
                user.firstName,

              lastName:
                user.lastName,
            },

            identity:
              activatedIdentity,

            member,

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
        },
      );

    return {
      message:
        'Invitation acceptée. Votre accès organisation est maintenant actif.',

      ...result,
    };
  }

  private async findValidInvitation(
    token:
      string,
  ) {
    const normalizedToken =
      token?.trim();

    if (
      !normalizedToken
    ) {
      throw new BadRequestException(
        'Token d’invitation manquant.',
      );
    }

    const tokenHash =
      createHash(
        'sha256',
      )
        .update(
          normalizedToken,
        )
        .digest(
          'hex',
        );

    const invitation =
      await this.prisma.invitation.findUnique({
        where: {
          tokenHash,
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

          invitedBy: {
            select: {
              id:
                true,

              email:
                true,

              firstName:
                true,

              lastName:
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
        'Invitation invalide.',
      );
    }

    if (
      invitation.revokedAt
    ) {
      throw new BadRequestException(
        'Cette invitation a été annulée.',
      );
    }

    if (
      invitation.acceptedAt
    ) {
      throw new ConflictException(
        'Cette invitation a déjà été acceptée.',
      );
    }

    if (
      invitation.expiresAt <=
      new Date()
    ) {
      throw new BadRequestException(
        'Cette invitation a expiré.',
      );
    }

    return invitation;
  }
}
