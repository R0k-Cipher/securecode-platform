import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditAction,
  NotificationType,
  UserStatus,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import * as argon2
  from 'argon2';

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
    token: string,
  ) {
    const invitation =
      await this.findValidInvitation(
        token,
      );

    const existingUser =
      await this.prisma.user
        .findUnique({
          where: {
            email:
              invitation.email,
          },

          select: {
            id:
              true,
          },
        });

    return {
      email:
        invitation.email,

      organization:
        invitation.organization,

      role:
        invitation.role,

      invitedBy:
        invitation.invitedBy,

      expiresAt:
        invitation.expiresAt,

      existingUser:
        Boolean(
          existingUser,
        ),
    };
  }

  async registerInvitedUser(
    token: string,
    dto:
      RegisterInvitedUserDto,
  ) {
    const invitation =
      await this.findValidInvitation(
        token,
      );

    const existingUser =
      await this.prisma.user
        .findUnique({
          where: {
            email:
              invitation.email,
          },

          select: {
            id:
              true,
          },
        });

    if (existingUser) {
      throw new ConflictException(
        'Un compte existe déjà pour cette adresse. Connectez-vous puis acceptez l’invitation.',
      );
    }

    const passwordHash =
      await argon2.hash(
        dto.password,
      );

    const result =
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            const user =
              await transaction.user
                .create({
                  data: {
                    email:
                      invitation.email,

                    firstName:
                      dto.firstName,

                    lastName:
                      dto.lastName,

                    passwordHash,

                    status:
                      UserStatus.ACTIVE,

                    platformRole:
                      'USER',
                  },

                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    status: true,
                  },
                });

            const member =
              await transaction.organizationMember
                .create({
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
                      new Date(),
                  },

                  include: {
                    role: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                      },
                    },

                    organization: {
                      select: {
                        id: true,
                        name: true,
                        slug: true,
                      },
                    },
                  },
                });

            await transaction.invitation
              .update({
                where: {
                  id:
                    invitation.id,
                },

                data: {
                  acceptedAt:
                    new Date(),
                },
              });

            await transaction.auditLog
              .create({
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
                    `${user.email} a créé son compte et accepté l’invitation`,
                },
              });

            await transaction.notification
              .create({
                data: {
                  userId:
                    user.id,

                  type:
                    NotificationType.SYSTEM,

                  title:
                    `Bienvenue dans ${invitation.organization.name}`,

                  message:
                    `Votre compte SecureCode a été créé avec le rôle ${invitation.role.name}.`,

                  metadata: {
                    organizationId:
                      invitation.organizationId,
                  },
                },
              });

            return {
              user,
              member,
            };
          },
        );

    return {
      message:
        'Compte créé et invitation acceptée. Vous pouvez maintenant vous connecter.',

      ...result,
    };
  }

  private async findValidInvitation(
    token: string,
  ) {
    if (
      !token?.trim()
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
          token,
        )
        .digest(
          'hex',
        );

    const invitation =
      await this.prisma.invitation
        .findUnique({
          where: {
            tokenHash,
          },

          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },

            role: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            invitedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
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
