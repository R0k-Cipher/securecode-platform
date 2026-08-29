import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  ProjectStatus,
} from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

import { EmailService } from '../email/email.service';

import { PrismaService } from '@securecode-platform/database';

import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { OrganizationQueryDto } from './dto/organization-query.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationMapper } from './mappers/organization.mapper';

import {
  AuditService,
} from '../audit/audit.service';

@Injectable()
export class OrganizationsService {
  private readonly invitationExpirationDays = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Crée une organisation et ajoute automatiquement le créateur
   * comme membre avec le rôle OWNER.
   */
  async create(
    currentUserId: string,
    dto: CreateOrganizationDto,
  ) {
    const name = dto.name.trim();
    const slug = await this.generateUniqueSlug(
      dto.slug ?? name,
    );

    const ownerRole = await this.getRoleByCode('OWNER');

    const organization = await this.prisma.$transaction(
      async (transaction) => {
        const createdOrganization =
          await transaction.organization.create({
            data: {
              name,
              slug,
              description: this.normalizeOptionalText(
                dto.description,
              ),
              logoUrl: this.normalizeOptionalText(dto.logoUrl),
              createdById: currentUserId,
            },
          });

        await transaction.organizationMember.create({
          data: {
            organizationId: createdOrganization.id,
            userId: currentUserId,
            roleId: ownerRole.id,
            joinedAt: new Date(),
          },
        });

        await transaction.auditLog.create({
          data: {
            organizationId: createdOrganization.id,
            actorId: currentUserId,
            action: AuditAction.CREATE,
            resourceType: 'Organization',
            resourceId: createdOrganization.id,
            description: `Organisation "${createdOrganization.name}" créée`,
            metadata: {
              slug: createdOrganization.slug,
            },
          },
        });

        return transaction.organization.findUniqueOrThrow({
          where: {
            id: createdOrganization.id,
          },
          include: {
            _count: {
              select: {
                members: true,
                projects: true,
              },
            },
          },
        });
      },
    );

    return OrganizationMapper.withStatistics(organization);
  }

  /**
   * Retourne uniquement les organisations dont l'utilisateur
   * connecté est membre.
   */
  async findAllForUser(
    currentUserId: string,
    query: OrganizationQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.OrganizationWhereInput = {
      members: {
        some: {
          userId: currentUserId,
        },
      },
      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                slug: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [organizations, total] =
      await this.prisma.$transaction([
        this.prisma.organization.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            _count: {
              select: {
                members: true,
                projects: true,
              },
            },
            members:{
              where:{
                userId:currentUserId,
              },
              take: 1,

              select: {
                role:{
                  select:{
                    id :true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.organization.count({
          where,
        }),
      ]);

    return {
      data: organizations.map(
        (organization) => {
          const mapped =
            OrganizationMapper.withStatistics(
              organization,
            );

          return {
            ...mapped,

            currentUserRole:
              organization.members[0]?.role ??
              null,
          };
        },
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Retourne une organisation uniquement si l'utilisateur
   * est membre de celle-ci.
   */
  async findOne(
    organizationId: string,
    currentUserId: string,
  ) {
    await this.ensureOrganizationMember(
      organizationId,
      currentUserId,
    );

    const organization =
      await this.prisma.organization.findUnique({
        where: {
          id: organizationId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              status: true,
              emailVerifiedAt: true,
              lastLoginAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          _count: {
            select: {
              members: true,
              projects: true,
              invitations: true,
              gitConnections: true,
            },
          },
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Organisation introuvable',
      );
    }

    return organization;
  }

  /**
   * Modifie les informations principales d'une organisation.
   * OWNER et ADMIN sont autorisés.
   */
  async update(
    organizationId: string,
    currentUserId: string,
    dto: UpdateOrganizationDto,
  ) {
    await this.ensureUserHasOrganizationRole(
      organizationId,
      currentUserId,
      ['OWNER', 'ADMIN'],
    );

    await this.ensureOrganizationExists(organizationId);

    let slug: string | undefined;

    if (dto.slug !== undefined) {
      slug = await this.generateUniqueSlug(
        dto.slug,
        organizationId,
      );
    }

    const organization =
      await this.prisma.$transaction(
        async (transaction) => {
          const updatedOrganization =
            await transaction.organization.update({
              where: {
                id: organizationId,
              },
              data: {
                ...(dto.name !== undefined
                  ? {
                      name: dto.name.trim(),
                    }
                  : {}),
                ...(slug !== undefined
                  ? {
                      slug,
                    }
                  : {}),
                ...(dto.description !== undefined
                  ? {
                      description:
                        this.normalizeOptionalText(
                          dto.description,
                        ),
                    }
                  : {}),
                ...(dto.logoUrl !== undefined
                  ? {
                      logoUrl: this.normalizeOptionalText(
                        dto.logoUrl,
                      ),
                    }
                  : {}),
              },
              include: {
                _count: {
                  select: {
                    members: true,
                    projects: true,
                  },
                },
              },
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              actorId: currentUserId,
              action: AuditAction.UPDATE,
              resourceType: 'Organization',
              resourceId: organizationId,
              description: `Organisation "${updatedOrganization.name}" modifiée`,
              metadata: {
                updatedFields: Object.keys(dto),
              },
            },
          });

          return updatedOrganization;
        },
      );

    return OrganizationMapper.withStatistics(organization);
  }

  /**
   * Supprime une organisation.
   * Seul le OWNER peut effectuer cette action.
   */
  async remove(
    organizationId: string,
    currentUserId: string,
  ) {
    await this.ensureUserHasOrganizationRole(
      organizationId,
      currentUserId,
      ['OWNER'],
    );

    const organization =
      await this.prisma.organization.findUnique({
        where: {
          id: organizationId,
        },
        select: {
          id: true,
          name: true,
          projects: {
            where: {
              status: ProjectStatus.ACTIVE,
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Organisation introuvable',
      );
    }

    if (organization.projects.length > 0) {
      throw new ConflictException(
        'Impossible de supprimer une organisation contenant des projets actifs',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.auditLog.create({
        data: {
          organizationId,
          actorId: currentUserId,
          action: AuditAction.DELETE,
          resourceType: 'Organization',
          resourceId: organizationId,
          description: `Organisation "${organization.name}" supprimée`,
        },
      });

      await transaction.organization.delete({
        where: {
          id: organizationId,
        },
      });
    });

    return {
      message: 'Organisation supprimée avec succès',
    };
  }

  /**
   * Liste les membres d'une organisation.
   */
  async getMembers(
    organizationId: string,
    currentUserId: string,
  ) {
    await this.ensureOrganizationMember(
      organizationId,
      currentUserId,
    );

    const members =
      await this.prisma.organizationMember.findMany({
        where: {
          organizationId,
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          roleId: true,
          invitedById: true,
          joinedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              status: true,
              emailVerifiedAt: true,
              lastLoginAt: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          role: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              isSystem: true,
              createdAt: true,
              updatedAt: true,
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

    return {
      data: members,
      total: members.length,
    };
  }

  /**
   * Crée une invitation pour rejoindre une organisation.
   *
   * Le token brut doit être envoyé par email.
   * Seul son hash est stocké en base.
   */

  async inviteMember(
    organizationId: string,
    currentUserId: string,
    dto: InviteMemberDto,
  ) {
    await this.ensureUserHasOrganizationRole(
      organizationId,
      currentUserId,
      [
        'OWNER',
        'ADMIN',
      ],
    );

    const organization =
      await this.prisma.organization
        .findUnique({
          where: {
            id:
              organizationId,
          },

          select: {
            id: true,
            name: true,
            slug: true,
          },
        });

    if (!organization) {
      throw new NotFoundException(
        'Organisation introuvable',
      );
    }

    const inviter =
      await this.prisma.user
        .findUnique({
          where: {
            id:
              currentUserId,
          },

          select: {
            firstName:
              true,

            lastName:
              true,

            email:
              true,
          },
        });

    if (!inviter) {
      throw new NotFoundException(
        'Utilisateur invitant introuvable.',
      );
    }

    const email =
      dto.email
        .trim()
        .toLowerCase();

    const role =
      await this.prisma.role
        .findUnique({
          where: {
            id:
              dto.roleId,
          },

          select: {
            id: true,
            code: true,
            name: true,
          },
        });

    if (!role) {
      throw new NotFoundException(
        'Rôle introuvable',
      );
    }

    if (
      role.code ===
      'OWNER'
    ) {
      throw new ForbiddenException(
        'Le rôle OWNER ne peut pas être attribué par invitation',
      );
    }

    const existingUser =
      await this.prisma.user
        .findUnique({
          where: {
            email,
          },

          select: {
            id: true,
          },
        });

    if (existingUser) {
      const membership =
        await this.prisma.organizationMember
          .findUnique({
            where: {
              organizationId_userId: {
                organizationId,
                userId:
                  existingUser.id,
              },
            },
          });

      if (membership) {
        throw new ConflictException(
          'Cet utilisateur est déjà membre de l’organisation',
        );
      }
    }

    const activeInvitation =
      await this.prisma.invitation
        .findFirst({
          where: {
            organizationId,
            email,
            acceptedAt:
              null,
            revokedAt:
              null,

            expiresAt: {
              gt:
                new Date(),
            },
          },
        });

    if (activeInvitation) {
      throw new ConflictException(
        'Une invitation active existe déjà pour cette adresse email',
      );
    }

    const token =
      randomBytes(
        48,
      )
        .toString(
          'hex',
        );

    const tokenHash =
      this.hashToken(
        token,
      );

    const expiresAt =
      new Date();

    expiresAt.setDate(
      expiresAt.getDate() +
        this.invitationExpirationDays,
    );

    const invitation =
      await this.prisma.$transaction(
        async (
          transaction,
        ) => {
          const created =
            await transaction.invitation
              .create({
                data: {
                  organizationId,
                  email,
                  roleId:
                    role.id,
                  invitedById:
                    currentUserId,
                  tokenHash,
                  expiresAt,
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


          if (existingUser) {
            await transaction.notification
              .create({
                data: {
                  userId:
                    existingUser.id,

                  type:
                    'INVITATION',

                  title:
                    `Invitation à rejoindre ${organization.name}`,

                  message:
                    `Vous avez été invité avec le rôle ${role.name}.`,

                  metadata: {
                    organizationId,
                    invitationId:
                      created.id,
                  },
                },
              });
          }

          return created;
        },
      );


    await this.auditService.create({
      organizationId,
      actorId: currentUserId,

      action: AuditAction.INVITE,

      resourceType: 'Invitation',

      resourceId: invitation.id,

      description:
        `Invitation envoyée à ${email}`,

      metadata: {
        email,

        roleCode:
          role.code,

        expiresAt:
          expiresAt.toISOString(),
      },
    });

    const delivery =
      await this.emailService
        .sendOrganizationInvitation({
          to:
            email,

          organizationName:
            organization.name,

          inviterName:
            `${inviter.firstName} ${inviter.lastName}`.trim() ||
            inviter.email,

          roleName:
            role.name,

          token,

          expiresAt,
        });

    return {
      invitation,
      expiresAt,

      delivery: {
        emailSent:
          delivery.sent,

        messageId:
          delivery.messageId,
      },

      /*
      * Utile uniquement en développement si SMTP n'est pas configuré.
      * En production, vous pouvez supprimer invitationToken de la réponse.
      */
      invitationToken:
        delivery.sent
          ? undefined
          : token,

      message:
        delivery.sent
          ? 'Invitation créée et envoyée par email.'
          : 'Invitation créée. SMTP non configuré : utilisez invitationToken pour le test local.',
    };
  }

  /**
   * Liste les invitations d'une organisation.
   */
  async getInvitations(
    organizationId: string,
    currentUserId: string,
  ) {
    await this.ensureUserHasOrganizationRole(
      organizationId,
      currentUserId,
      ['OWNER', 'ADMIN'],
    );

    const invitations =
      await this.prisma.invitation.findMany({
        where: {
          organizationId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          email: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          createdAt: true,
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

    return {
      data: invitations,
      total: invitations.length,
    };
  }

  /**
   * Annule une invitation non acceptée.
   */
  async cancelInvitation(
    organizationId: string,
    invitationId: string,
    currentUserId: string,
  ) {
    await this.ensureUserHasOrganizationRole(
      organizationId,
      currentUserId,
      ['OWNER', 'ADMIN'],
    );

    const invitation =
      await this.prisma.invitation.findFirst({
        where: {
          id: invitationId,
          organizationId,
        },
      });

    if (!invitation) {
      throw new NotFoundException(
        'Invitation introuvable',
      );
    }

    if (invitation.acceptedAt) {
      throw new ConflictException(
        'Une invitation déjà acceptée ne peut pas être annulée',
      );
    }

    if (invitation.revokedAt) {
      throw new ConflictException(
        'Cette invitation est déjà annulée',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.invitation.update({
        where: {
          id: invitationId,
        },
        data: {
          revokedAt: new Date(),
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorId: currentUserId,
          action: AuditAction.DELETE,
          resourceType: 'Invitation',
          resourceId: invitationId,
          description: `Invitation de ${invitation.email} annulée`,
          metadata: {
            email: invitation.email,
          },
        },
      });
    });

    return {
      message: 'Invitation annulée avec succès',
    };
  }

  /**
   * Accepte une invitation et ajoute l'utilisateur comme membre.
   */
  async acceptInvitation(
    currentUserId: string,
    dto: AcceptInvitationDto,
  ) {
    const tokenHash = this.hashToken(dto.token);

    const invitation =
      await this.prisma.invitation.findUnique({
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
          role: true,
        },
      });

    if (!invitation) {
      throw new BadRequestException(
        'Invitation invalide',
      );
    }

    if (invitation.revokedAt) {
      throw new BadRequestException(
        'Cette invitation a été annulée',
      );
    }

    if (invitation.acceptedAt) {
      throw new ConflictException(
        'Cette invitation a déjà été acceptée',
      );
    }

    if (invitation.expiresAt <= new Date()) {
      throw new BadRequestException(
        'Cette invitation a expiré',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: currentUserId,
      },
      select: {
        id: true,
        email: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        'Utilisateur introuvable',
      );
    }

    if (
      user.email.trim().toLowerCase() !==
      invitation.email.trim().toLowerCase()
    ) {
      throw new ForbiddenException(
        'Cette invitation appartient à une autre adresse email',
      );
    }

    const existingMembership =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: currentUserId,
          },
        },
      });

    if (existingMembership) {
      throw new ConflictException(
        'Vous êtes déjà membre de cette organisation',
      );
    }

    const member = await this.prisma.$transaction(
      async (transaction) => {
        const createdMember =
          await transaction.organizationMember.create({
            data: {
              organizationId:
                invitation.organizationId,
              userId: currentUserId,
              roleId: invitation.roleId,
              invitedById: invitation.invitedById,
              joinedAt: new Date(),
            },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  status: true,
                  emailVerifiedAt: true,
                  lastLoginAt: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          });

        await transaction.invitation.update({
          where: {
            id: invitation.id,
          },
          data: {
            acceptedAt: new Date(),
          },
        });

        await transaction.auditLog.create({
          data: {
            organizationId:
              invitation.organizationId,
            actorId: currentUserId,
            action:
              AuditAction.ACCEPT_INVITATION,
            resourceType: 'Invitation',
            resourceId: invitation.id,
            description: `${user.email} a accepté l’invitation`,
            metadata: {
              roleCode: invitation.role.code,
            },
          },
        });

        return createdMember;
      },
    );

    return {
      message: 'Invitation acceptée avec succès',
      member,
    };
  }

  /**
   * Modifie le rôle d'un membre.
   */
  async updateMemberRole(
    organizationId: string,
    memberId: string,
    currentUserId: string,
    dto: UpdateMemberRoleDto,
  ) {
    await this.ensureUserHasOrganizationRole(
      organizationId,
      currentUserId,
      ['OWNER', 'ADMIN'],
    );

    const member =
      await this.prisma.organizationMember.findFirst({
        where: {
          id: memberId,
          organizationId,
        },
        include: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

    if (!member) {
      throw new NotFoundException(
        'Membre introuvable',
      );
    }

    const newRole = await this.prisma.role.findUnique({
      where: {
        id: dto.roleId,
      },
    });

    if (!newRole) {
      throw new NotFoundException(
        'Rôle introuvable',
      );
    }

    if (member.role.code === 'OWNER') {
      throw new ForbiddenException(
        'Le rôle du propriétaire ne peut pas être modifié directement',
      );
    }

    if (newRole.code === 'OWNER') {
      throw new ForbiddenException(
        'Le rôle OWNER ne peut pas être attribué depuis cette opération',
      );
    }

    const currentMembership =
      await this.ensureOrganizationMember(
        organizationId,
        currentUserId,
      );

    if (
      currentMembership.role.code === 'ADMIN' &&
      newRole.code === 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Un administrateur ne peut pas promouvoir un membre au rôle ADMIN',
      );
    }

    const updatedMember =
      await this.prisma.$transaction(
        async (transaction) => {
          const result =
            await transaction.organizationMember.update({
              where: {
                id: memberId,
              },
              data: {
                roleId: newRole.id,
              },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                    status: true,
                  },
                },
                role: true,
              },
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              actorId: currentUserId,
              action: AuditAction.UPDATE,
              resourceType: 'OrganizationMember',
              resourceId: memberId,
              description: `Rôle de ${member.user.email} modifié`,
              metadata: {
                previousRole: member.role.code,
                newRole: newRole.code,
              },
            },
          });

          return result;
        },
      );

    return updatedMember;
  }

  /**
   * Retire un membre d'une organisation.
   */
  async removeMember(
    organizationId: string,
    memberId: string,
    currentUserId: string,
  ) {
    await this.ensureUserHasOrganizationRole(
      organizationId,
      currentUserId,
      ['OWNER', 'ADMIN'],
    );

    const member =
      await this.prisma.organizationMember.findFirst({
        where: {
          id: memberId,
          organizationId,
        },
        include: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

    if (!member) {
      throw new NotFoundException(
        'Membre introuvable',
      );
    }

    if (member.role.code === 'OWNER') {
      throw new ForbiddenException(
        'Le propriétaire ne peut pas être retiré de l’organisation',
      );
    }

    const currentMembership =
      await this.ensureOrganizationMember(
        organizationId,
        currentUserId,
      );

    if (
      currentMembership.role.code === 'ADMIN' &&
      member.role.code === 'ADMIN'
    ) {
      throw new ForbiddenException(
        'Un administrateur ne peut pas retirer un autre administrateur',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.organizationMember.delete({
        where: {
          id: memberId,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorId: currentUserId,
          action: AuditAction.DELETE,
          resourceType: 'OrganizationMember',
          resourceId: memberId,
          description: `${member.user.email} retiré de l’organisation`,
          metadata: {
            removedUserId: member.user.id,
            removedRole: member.role.code,
          },
        },
      });
    });

    return {
      message: 'Membre retiré avec succès',
    };
  }

  /**
   * Permet à un utilisateur de quitter une organisation.
   */
  async leaveOrganization(
    organizationId: string,
    currentUserId: string,
  ) {
    const membership =
      await this.ensureOrganizationMember(
        organizationId,
        currentUserId,
      );

    if (membership.role.code === 'OWNER') {
      throw new ForbiddenException(
        'Le propriétaire doit transférer la propriété avant de quitter l’organisation',
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.organizationMember.delete({
        where: {
          id: membership.id,
        },
      });

      await transaction.auditLog.create({
        data: {
          organizationId,
          actorId: currentUserId,
          action: AuditAction.DELETE,
          resourceType: 'OrganizationMember',
          resourceId: membership.id,
          description:
            'Un utilisateur a quitté l’organisation',
          metadata: {
            userId: currentUserId,
          },
        },
      });
    });

    return {
      message: 'Vous avez quitté l’organisation',
    };
  }

  private async ensureOrganizationExists(
    organizationId: string,
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
        'Organisation introuvable',
      );
    }
  }

  private async ensureOrganizationMember(
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
        include: {
          role: true,
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        'Vous n’êtes pas membre de cette organisation',
      );
    }

    return membership;
  }

  private async ensureUserHasOrganizationRole(
    organizationId: string,
    userId: string,
    allowedRoles: string[],
  ) {
    const membership =
      await this.ensureOrganizationMember(
        organizationId,
        userId,
      );

    if (!allowedRoles.includes(membership.role.code)) {
      throw new ForbiddenException(
        'Vous ne disposez pas des autorisations nécessaires',
      );
    }

    return membership;
  }

  private async getRoleByCode(code: string) {
    const role = await this.prisma.role.findUnique({
      where: {
        code,
      },
    });

    if (!role) {
      throw new NotFoundException(
        `Le rôle système "${code}" est introuvable. Exécutez le seed RBAC.`,
      );
    }

    return role;
  }

  private async generateUniqueSlug(
    source: string,
    excludedOrganizationId?: string,
  ): Promise<string> {
    const baseSlug = this.slugify(source);

    if (!baseSlug) {
      throw new BadRequestException(
        'Impossible de générer un slug valide',
      );
    }

    let candidate = baseSlug;
    let suffix = 1;

    while (
      await this.prisma.organization.findFirst({
        where: {
          slug: candidate,
          ...(excludedOrganizationId
            ? {
                id: {
                  not: excludedOrganizationId,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      })
    ) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
  }

    /*
  Ajoutez cette méthode dans OrganizationsService :
  */

  async getAssignableRoles(
    organizationId: string,
    currentUserId: string,
  ) {
    await this.ensureUserHasOrganizationRole(
      organizationId,
      currentUserId,
      [
        'OWNER',
        'ADMIN',
      ],
    );

    return this.prisma.role
      .findMany({
        where: {
          code: {
            in: [
              'ADMIN',
              'MANAGER',
              'SECURITY_ANALYST',
              'DEVELOPER',
              'AUDITOR',
              'VIEWER',
            ],
          },
        },

        orderBy: {
          code:
            'asc',
        },

        select: {
          id: true,
          code: true,
          name: true,
          description: true,
        },
      });
  }

  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }


  private normalizeOptionalText(
    value: string | null | undefined,
  ): string | null {
    if (
      value === undefined ||
      value === null
    ) {
      return null;
    }

    const normalized =
      value.trim();

    return normalized.length
      ? normalized
      : null;
  }

  async requireManagementAccess(
    organizationId: string,
    userId: string,
  ) {
    return this.ensureUserHasOrganizationRole(
      organizationId,
      userId,
      [
        'OWNER',
        'ADMIN',
      ],
    );
  }

}
