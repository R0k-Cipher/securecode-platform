
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

import * as argon2 from 'argon2';

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
  PERMISSION_CODES,
  RbacService,
 } from '../rbac';

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
    private readonly rbacService:RbacService,
  ) {}


  async create(
    currentUserId: string,
    dto: CreateOrganizationDto,
  ) {
    const name =
      dto.name.trim();

    const ownerEmail =
      dto.ownerEmail
        .trim()
        .toLowerCase();

    const ownerFirstName =
      dto.ownerFirstName.trim();

    const ownerLastName =
      dto.ownerLastName.trim();

    /*
    |--------------------------------------------------------------------------
    | 1. Vérifier le Platform Admin
    |--------------------------------------------------------------------------
    */

    const platformAdmin =
      await this.prisma.user.findUnique({
        where: {
          id: currentUserId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          platformRole: true,
          status: true,
        },
      });

    if (!platformAdmin) {
      throw new NotFoundException(
        'Administrateur plateforme introuvable.',
      );
    }

    if (
      platformAdmin.platformRole !==
      'PLATFORM_ADMIN'
    ) {
      throw new ForbiddenException(
        'Seul un administrateur de la plateforme peut créer une organisation.',
      );
    }

    if (
      platformAdmin.status !==
      'ACTIVE'
    ) {
      throw new ForbiddenException(
        'Le compte administrateur plateforme n’est pas actif.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | 2. Slug + rôle OWNER
    |--------------------------------------------------------------------------
    */

    const slug =
      await this.generateUniqueSlug(
        dto.slug ?? name,
      );

    const ownerRole =
      await this.getRoleByCode(
        'OWNER',
      );

    /*
    |--------------------------------------------------------------------------
    | 3. Chercher le User global du OWNER
    |--------------------------------------------------------------------------
    */

    const existingOwner =
      await this.prisma.user.findUnique({
        where: {
          email: ownerEmail,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          platformRole: true,
          status: true,
        },
      });

    if (
      existingOwner?.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      throw new BadRequestException(
        'Un administrateur de la plateforme ne peut pas devenir OWNER d’une organisation cliente.',
      );
    }

    if (
      existingOwner &&
      (
        existingOwner.status ===
          'DISABLED' ||
        existingOwner.status ===
          'SUSPENDED'
      )
    ) {
      throw new BadRequestException(
        'Le compte du propriétaire est désactivé ou suspendu.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | 4. Préparer invitation
    |--------------------------------------------------------------------------
    */

    const token =
      randomBytes(48)
        .toString('hex');

    const tokenHash =
      this.hashToken(token);

    const expiresAt =
      new Date();

    expiresAt.setDate(
      expiresAt.getDate() +
        this.invitationExpirationDays,
    );

    const temporaryPassword =
      this.generateTemporaryPassword();

    const temporaryPasswordHash =
      await this.hashTemporaryPassword(
        temporaryPassword,
      );

    /*
    |--------------------------------------------------------------------------
    | 5. Login professionnel du OWNER
    |--------------------------------------------------------------------------
    */

    const organizationLogin =
      await this.generateUniqueLogin(
        ownerFirstName,
        ownerLastName,
        slug,
      );

    /*
    |--------------------------------------------------------------------------
    | 6. Transaction
    |--------------------------------------------------------------------------
    */

    const result =
      await this.prisma.$transaction(
        async transaction => {
          /*
          |--------------------------------------------------------------------------
          | User global
          |--------------------------------------------------------------------------
          |
          | Le User représente la personne physique.
          | Il reste ACTIVE.
          |
          | C'est OrganizationIdentity qui reste INVITED.
          */

          let owner =
            existingOwner;

          if (!owner) {
            owner =
              await transaction.user.create({
                data: {
                  email:
                    ownerEmail,

                  firstName:
                    ownerFirstName,

                  lastName:
                    ownerLastName,

                  passwordHash:
                    null,

                  status:
                    'ACTIVE',

                  platformRole:
                    'USER',
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

                  platformRole:
                    true,

                  status:
                    true,
                },
              });
          } else if (
            owner.status !==
            'ACTIVE'
          ) {
            owner =
              await transaction.user.update({
                where: {
                  id:
                    owner.id,
                },

                data: {
                  status:
                    'ACTIVE',
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

                  platformRole:
                    true,

                  status:
                    true,
                },
              });
          }

          /*
          |--------------------------------------------------------------------------
          | Organization
          |--------------------------------------------------------------------------
          |
          | createdById reste le Platform Admin.
          | Cela ne lui donne aucun rôle dans le tenant.
          */

          const createdOrganization =
            await transaction.organization.create({
              data: {
                name,

                slug,

                description:
                  this.normalizeOptionalText(
                    dto.description,
                  ),

                logoUrl:
                  this.normalizeOptionalText(
                    dto.logoUrl,
                  ),

                createdById:
                  currentUserId,
              },
            });

          /*
          |--------------------------------------------------------------------------
          | OrganizationIdentity du futur OWNER
          |--------------------------------------------------------------------------
          */

          const identity =
            await transaction.organizationIdentity.create({
              data: {
                organizationId:
                  createdOrganization.id,

                userId:
                  owner.id,

                login:
                  organizationLogin,

                passwordHash:
                  temporaryPasswordHash,

                status:
                  'INVITED',

                mustChangePassword:
                  true,

                temporaryPasswordExpiresAt:
                  expiresAt,

                activatedAt:
                  null,
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
            });

          /*
          |--------------------------------------------------------------------------
          | Invitation OWNER
          |--------------------------------------------------------------------------
          |
          | IMPORTANT :
          | on ne crée PAS OrganizationMember ici.
          |
          | InvitationsService.registerInvitedUser()
          | le créera après acceptation du lien.
          */

          const invitation =
            await transaction.invitation.create({
              data: {
                organizationId:
                  createdOrganization.id,

                email:
                  ownerEmail,

                roleId:
                  ownerRole.id,

                invitedById:
                  currentUserId,

                tokenHash,

                expiresAt,

                acceptedAt:
                  null,

                revokedAt:
                  null,
              },

              select: {
                id:
                  true,

                email:
                  true,

                expiresAt:
                  true,

                acceptedAt:
                  true,

                revokedAt:
                  true,

                createdAt:
                  true,
              },
            });

          /*
          |--------------------------------------------------------------------------
          | Notification interne
          |--------------------------------------------------------------------------
          */

          await transaction.notification.create({
            data: {
              userId:
                owner.id,

              type:
                'INVITATION',

              title:
                `Invitation à rejoindre ${createdOrganization.name}`,

              message:
                `Vous avez été désigné comme propriétaire de ${createdOrganization.name}.`,

              metadata: {
                organizationId:
                  createdOrganization.id,

                invitationId:
                  invitation.id,

                organizationRoleCode:
                  'OWNER',

                ownerInvitation:
                  true,
              },
            },
          });

          /*
          |--------------------------------------------------------------------------
          | Audit création organisation
          |--------------------------------------------------------------------------
          */

          await transaction.auditLog.create({
            data: {
              organizationId:
                createdOrganization.id,

              actorId:
                currentUserId,

              action:
                AuditAction.CREATE,

              resourceType:
                'Organization',

              resourceId:
                createdOrganization.id,

              description:
                `Organisation "${createdOrganization.name}" créée par un administrateur de la plateforme`,

              metadata: {
                slug:
                  createdOrganization.slug,

                ownerUserId:
                  owner.id,

                ownerEmail:
                  owner.email,

                ownerRole:
                  'OWNER',

                ownerIdentityId:
                  identity.id,

                ownerIdentityStatus:
                  identity.status,

                ownerInvitationId:
                  invitation.id,
              },
            },
          });

          /*
          |--------------------------------------------------------------------------
          | Audit invitation OWNER
          |--------------------------------------------------------------------------
          */

          await transaction.auditLog.create({
            data: {
              organizationId:
                createdOrganization.id,

              actorId:
                currentUserId,

              action:
                AuditAction.INVITE,

              resourceType:
                'Invitation',

              resourceId:
                invitation.id,

              description:
                `Invitation OWNER envoyée à ${ownerEmail}`,

              metadata: {
                email:
                  ownerEmail,

                login:
                  identity.login,

                organizationRoleCode:
                  'OWNER',

                expiresAt:
                  expiresAt.toISOString(),

                initialOwnerInvitation:
                  true,
              },
            },
          });

          const organization =
            await transaction.organization.findUniqueOrThrow({
              where: {
                id:
                  createdOrganization.id,
              },

              include: {
                _count: {
                  select: {
                    members:
                      true,

                    projects:
                      true,
                  },
                },
              },
            });

          return {
            organization,
            owner,
            identity,
            invitation,
          };
        },
      );

    /*
    |--------------------------------------------------------------------------
    | 7. Email
    |--------------------------------------------------------------------------
    |
    | Hors transaction : une panne SMTP ne doit pas annuler
    | la création de l'organisation.
    */

    const inviterName =
      `${platformAdmin.firstName} ${platformAdmin.lastName}`
        .trim() ||
      platformAdmin.email;

    const delivery =
      await this.emailService
        .sendOrganizationInvitationWithCredentials({
          to:
            ownerEmail,

          login:
            result.identity.login,

          organizationName:
            result.organization.name,

          inviterName,

          roleName:
            ownerRole.name,

          temporaryPassword,

          token,

          expiresAt,
        });

    /*
    |--------------------------------------------------------------------------
    | 8. Réponse
    |--------------------------------------------------------------------------
    */

    return {
      ...OrganizationMapper.withStatistics(
        result.organization,
      ),

      ownerInvitation: {
        id:
          result.invitation.id,

        email:
          result.invitation.email,

        expiresAt:
          result.invitation.expiresAt,

        login:
          result.identity.login,

        status:
          result.identity.status,

        emailSent:
          delivery.sent,

        messageId:
          delivery.messageId,
      },
    };
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

  async inviteMember(
    organizationId:
      string,

    currentUserId:
      string,

    dto:
      InviteMemberDto,
  ) {
    /*
    |--------------------------------------------------------------------------
    | Permission organisation
    |--------------------------------------------------------------------------
    */

    await this.rbacService
      .requireOrganizationPermission(
        organizationId,
        currentUserId,
        PERMISSION_CODES.MEMBER_INVITE,
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
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Organisation introuvable.',
      );
    }

    const inviter =
      await this.prisma.user.findUnique({
        where: {
          id:
            currentUserId,
        },

        select: {
          id:
            true,

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

    /*
    |--------------------------------------------------------------------------
    | Résolution du rôle organisation
    |--------------------------------------------------------------------------
    */

    let organizationRole:
      {
        id:
          string;

        code:
          string;

        name:
          string;

        scope:
          string;
      } |
      null =
      null;

    if (
      dto.organizationRoleCode
    ) {
      organizationRole =
        await this.prisma.role.findUnique({
          where: {
            code:
              dto.organizationRoleCode,
          },

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
        });
    } else if (
      dto.roleId
    ) {
      organizationRole =
        await this.prisma.role.findUnique({
          where: {
            id:
              dto.roleId,
          },

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
        });
    }

    if (!organizationRole) {
      throw new BadRequestException(
        'Un rôle organisation valide est obligatoire.',
      );
    }

    if (
      organizationRole.scope !==
      'ORGANIZATION'
    ) {
      throw new ForbiddenException(
        'Le rôle sélectionné n’est pas un rôle organisation.',
      );
    }

    if (
      ![
        'MEMBER',
        'ADMIN',
      ].includes(
        organizationRole.code,
      )
    ) {
      throw new ForbiddenException(
        'Seuls les rôles MEMBER et ADMIN peuvent être attribués par invitation.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Anti-escalation ADMIN
    |--------------------------------------------------------------------------
    */

    const inviterMembership =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId:
              currentUserId,
          },
        },

        include: {
          role: {
            select: {
              code:
                true,
            },
          },
        },
      });

    if (!inviterMembership) {
      throw new ForbiddenException(
        'Vous n’êtes pas membre de cette organisation.',
      );
    }

    if (
      inviterMembership.role.code ===
        'ADMIN' &&
      organizationRole.code ===
        'ADMIN'
    ) {
      throw new ForbiddenException(
        'Un administrateur ne peut pas inviter un autre utilisateur avec le rôle ADMIN.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Résolution et validation des projets
    |--------------------------------------------------------------------------
    */

    const requestedProjects =
      dto.projects ??
      [];

    const duplicatedProjectIds =
      requestedProjects
        .map(
          project =>
            project.projectId,
        )
        .filter(
          (
            projectId,
            index,
            all,
          ) =>
            all.indexOf(
              projectId,
            ) !== index,
        );

    if (
      duplicatedProjectIds.length >
      0
    ) {
      throw new BadRequestException(
        'Un même projet ne peut être présent plusieurs fois dans une invitation.',
      );
    }

    const projectAssignments:
      Array<{
        projectId:
          string;

        roleId:
          string;

        roleCode:
          string;

        projectName:
          string;
      }> =
      [];

    for (
      const requestedProject of
      requestedProjects
    ) {
      const project =
        await this.prisma.project.findFirst({
          where: {
            id:
              requestedProject.projectId,

            organizationId,
          },

          select: {
            id:
              true,

            name:
              true,

            organizationId:
              true,
          },
        });

      if (!project) {
        throw new NotFoundException(
          `Projet introuvable ou extérieur à l’organisation : ${requestedProject.projectId}.`,
        );
      }

      const projectRole =
        await this.prisma.role.findUnique({
          where: {
            code:
              requestedProject.roleCode,
          },

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
        });

      if (!projectRole) {
        throw new NotFoundException(
          `Rôle projet introuvable : ${requestedProject.roleCode}.`,
        );
      }

      if (
        projectRole.scope !==
        'PROJECT'
      ) {
        throw new ForbiddenException(
          `${projectRole.code} n’est pas un rôle projet valide.`,
        );
      }

      /*
      |--------------------------------------------------------------------------
      | OWNER peut gérer tous les projets.
      | Sinon il faut explicitement project-member:manage.
      |--------------------------------------------------------------------------
      */

      if (
        inviterMembership.role.code !==
        'OWNER'
      ) {
        await this.rbacService
          .requireProjectPermission(
            organizationId,
            project.id,
            currentUserId,
            PERMISSION_CODES.PROJECT_MEMBER_MANAGE,
          );
      }

      projectAssignments.push({
        projectId:
          project.id,

        roleId:
          projectRole.id,

        roleCode:
          projectRole.code,

        projectName:
          project.name,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | Utilisateur global
    |--------------------------------------------------------------------------
    */

    let existingUser =
      await this.prisma.user.findUnique({
        where: {
          email,
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

    if (
      existingUser?.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      throw new ForbiddenException(
        'Un administrateur plateforme ne peut pas rejoindre une organisation cliente.',
      );
    }

    if (
      existingUser &&
      (
        existingUser.status ===
          'DISABLED' ||
        existingUser.status ===
          'SUSPENDED'
      )
    ) {
      throw new ForbiddenException(
        'Ce compte utilisateur est désactivé ou suspendu.',
      );
    }

    if (
      existingUser
    ) {
      const membership =
        await this.prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId:
                existingUser.id,
            },
          },

          select: {
            id:
              true,
          },
        });

      if (membership) {
        throw new ConflictException(
          'Cet utilisateur est déjà membre de cette organisation.',
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Empêcher plusieurs invitations actives
    |--------------------------------------------------------------------------
    */

    const activeInvitation =
      await this.prisma.invitation.findFirst({
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

        select: {
          id:
            true,
        },
      });

    if (
      activeInvitation
    ) {
      throw new ConflictException(
        'Une invitation active existe déjà pour cette adresse email.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Token
    |--------------------------------------------------------------------------
    */

    const token =
      randomBytes(
        48,
      ).toString(
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

    /*
    |--------------------------------------------------------------------------
    | Login professionnel
    |--------------------------------------------------------------------------
    */

    let organizationLogin:
      string;

    const existingIdentity =
      existingUser
        ? await this.prisma.organizationIdentity.findUnique({
            where: {
              organizationId_userId: {
                organizationId,
                userId:
                  existingUser.id,
              },
            },

            select: {
              id:
                true,

              login:
                true,

              status:
                true,
            },
          })
        : null;

    if (
      existingIdentity?.status ===
      'ACTIVE'
    ) {
      throw new ConflictException(
        'L’identité professionnelle de cet utilisateur est déjà active dans cette organisation.',
      );
    }

    if (
      existingIdentity
    ) {
      organizationLogin =
        existingIdentity.login;
    } else {
      const firstName =
        dto.firstName?.trim() ||
        existingUser?.firstName?.trim() ||
        'user';

      const lastName =
        dto.lastName?.trim() ||
        existingUser?.lastName?.trim() ||
        'member';

      organizationLogin =
        await this.generateUniqueLogin(
          firstName,
          lastName,
          organization.slug,
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Mot de passe temporaire
    |--------------------------------------------------------------------------
    |
    | Il appartient à OrganizationIdentity, jamais au User global.
    |--------------------------------------------------------------------------
    */

    const temporaryPassword =
      this.generateTemporaryPassword();

    const temporaryPasswordHash =
      await this.hashTemporaryPassword(
        temporaryPassword,
      );

    const temporaryPasswordExpiresAt =
      new Date(
        expiresAt,
      );

    /*
    |--------------------------------------------------------------------------
    | Transaction atomique
    |--------------------------------------------------------------------------
    */

    const result =
      await this.prisma.$transaction(
        async transaction => {
          /*
          |--------------------------------------------------------------------------
          | User global ACTIVE
          |--------------------------------------------------------------------------
          */

          if (!existingUser) {
            if (
              !dto.firstName ||
              !dto.lastName
            ) {
              throw new BadRequestException(
                'firstName et lastName sont obligatoires pour un nouvel utilisateur.',
              );
            }

            existingUser =
              await transaction.user.create({
                data: {
                  email,

                  firstName:
                    dto.firstName.trim(),

                  lastName:
                    dto.lastName.trim(),

                  /*
                  |--------------------------------------------------------------------------
                  | Aucun mot de passe client sur User.
                  |--------------------------------------------------------------------------
                  */

                  passwordHash:
                    null,

                  status:
                    'ACTIVE',

                  platformRole:
                    'USER',
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
          }

          if (!existingUser) {
            throw new ConflictException(
              'Impossible de provisionner le compte utilisateur.',
            );
          }

          /*
          |--------------------------------------------------------------------------
          | OrganizationIdentity
          |--------------------------------------------------------------------------
          */

          let identity =
            await transaction.organizationIdentity.findUnique({
              where: {
                organizationId_userId: {
                  organizationId,

                  userId:
                    existingUser.id,
                },
              },

              select: {
                id:
                  true,

                login:
                  true,

                status:
                  true,
              },
            });

          if (!identity) {
            identity =
              await transaction.organizationIdentity.create({
                data: {
                  organizationId,

                  userId:
                    existingUser.id,

                  login:
                    organizationLogin,

                  passwordHash:
                    temporaryPasswordHash,

                  status:
                    'INVITED',

                  mustChangePassword:
                    true,

                  temporaryPasswordExpiresAt,

                  activatedAt:
                    null,
                },

                select: {
                  id:
                    true,

                  login:
                    true,

                  status:
                    true,
                },
              });
          } else {
            identity =
              await transaction.organizationIdentity.update({
                where: {
                  id:
                    identity.id,
                },

                data: {
                  passwordHash:
                    temporaryPasswordHash,

                  status:
                    'INVITED',

                  mustChangePassword:
                    true,

                  temporaryPasswordExpiresAt,

                  activatedAt:
                    null,
                },

                select: {
                  id:
                    true,

                  login:
                    true,

                  status:
                    true,
                },
              });
          }

          /*
          |--------------------------------------------------------------------------
          | Invitation
          |--------------------------------------------------------------------------
          */

          const invitation =
            await transaction.invitation.create({
              data: {
                organizationId,

                email,

                roleId:
                  organizationRole.id,

                invitedById:
                  currentUserId,

                tokenHash,

                expiresAt,

                acceptedAt:
                  null,

                revokedAt:
                  null,

                projectAssignments:
                  projectAssignments.length >
                  0
                    ? {
                        create:
                          projectAssignments.map(
                            assignment => ({
                              projectId:
                                assignment.projectId,

                              roleId:
                                assignment.roleId,
                            }),
                          ),
                      }
                    : undefined,
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

          /*
          |--------------------------------------------------------------------------
          | Notification interne
          |--------------------------------------------------------------------------
          */

          await transaction.notification.create({
            data: {
              userId:
                existingUser.id,

              type:
                'INVITATION',

              title:
                `Invitation à rejoindre ${organization.name}`,

              message:
                `Vous avez été invité avec le rôle ${organizationRole.name}.`,

              metadata: {
                organizationId,

                invitationId:
                  invitation.id,

                organizationRoleCode:
                  organizationRole.code,

                projectAssignments:
                  projectAssignments.map(
                    assignment => ({
                      projectId:
                        assignment.projectId,

                      roleCode:
                        assignment.roleCode,
                    }),
                  ),
              },
            },
          });

          return {
            invitation,

            identity,

            user:
              existingUser,
          };
        },
      );

    /*
    |--------------------------------------------------------------------------
    | Audit
    |--------------------------------------------------------------------------
    */

    await this.auditService.create({
      organizationId,

      actorId:
        currentUserId,

      action:
        AuditAction.INVITE,

      resourceType:
        'Invitation',

      resourceId:
        result.invitation.id,

      description:
        `Invitation envoyée à ${email}`,

      metadata: {
        email,

        login:
          result.identity.login,

        organizationRoleCode:
          organizationRole.code,

        projectAssignments:
          projectAssignments.map(
            assignment => ({
              projectId:
                assignment.projectId,

              roleCode:
                assignment.roleCode,
            }),
          ),

        expiresAt:
          expiresAt.toISOString(),
      },
    });

    /*
    |--------------------------------------------------------------------------
    | Email
    |--------------------------------------------------------------------------
    */

    const inviterName =
      `${inviter.firstName} ${inviter.lastName}`
        .trim() ||
      inviter.email;

    const delivery =
      await this.emailService
        .sendOrganizationInvitationWithCredentials({
          to:
            email,

          login:
            result.identity.login,

          organizationName:
            organization.name,

          inviterName,

          roleName:
            organizationRole.name,

          temporaryPassword,

          token,

          expiresAt,
        });

    return {
      message:
        delivery.sent
          ? 'Invitation envoyée avec succès.'
          : 'Invitation créée, mais l’email n’a pas pu être envoyé.',

      invitation:
        result.invitation,

      identity: {
        id:
          result.identity.id,

        login:
          result.identity.login,

        status:
          result.identity.status,
      },

      accountProvisioned:
        true,

      expiresAt,

      delivery: {
        emailSent:
          delivery.sent,

        messageId:
          delivery.messageId,
      },
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
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
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
              scope: true,
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
          projectAssignments: {
            select: {
              projectId: true,
              project: {
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
                  scope: true,
                },
              },
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
        where: { tokenHash },
        include: {
          organization: {
            select: { id: true, name: true, slug: true },
          },
          role: {
            select: {
              id: true,
              code: true,
              name: true,
              scope: true,
            },
          },
          projectAssignments: {
            include: {
              project: {
                select: {
                  id: true,
                  organizationId: true,
                  name: true,
                  slug: true,
                },
              },
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  scope: true,
                },
              },
            },
          },
        },
      });

    if (!invitation) {
      throw new BadRequestException('Invitation invalide');
    }
    if (invitation.revokedAt) {
      throw new BadRequestException('Cette invitation a été annulée');
    }
    if (invitation.acceptedAt) {
      throw new ConflictException('Cette invitation a déjà été acceptée');
    }
    if (invitation.expiresAt <= new Date()) {
      throw new BadRequestException('Cette invitation a expiré');
    }
    if (invitation.role.scope !== 'ORGANIZATION') {
      throw new ForbiddenException(
        'Le rôle de cette invitation n’est pas un rôle organisation valide.',
      );
    }

    for (const assignment of invitation.projectAssignments) {
      if (
        assignment.project.organizationId !== invitation.organizationId
      ) {
        throw new ForbiddenException(
          'Une affectation projet appartient à une autre organisation.',
        );
      }
      if (assignment.role.scope !== 'PROJECT') {
        throw new ForbiddenException(
          'Une affectation contient un rôle projet invalide.',
        );
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentUserId },
      select: { id: true, email: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    if (
      user.email.trim().toLowerCase() !==
      invitation.email.trim().toLowerCase()
    ) {
      throw new ForbiddenException(
        'Cette invitation appartient à une autre adresse email',
      );
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const existingMembership =
        await transaction.organizationMember.findUnique({
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

      const identity =
        await transaction.organizationIdentity.findUnique({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: currentUserId,
            },
          },
        });

      if (!identity) {
        throw new ConflictException(
          'Identité organisation introuvable pour cette invitation.',
        );
      }

      const member = await transaction.organizationMember.create({
        data: {
          organizationId: invitation.organizationId,
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
            },
          },
          role: true,
          organization: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (invitation.projectAssignments.length > 0) {
        await transaction.projectMember.createMany({
          data: invitation.projectAssignments.map((assignment) => ({
            projectId: assignment.projectId,
            userId: currentUserId,
            roleId: assignment.roleId,
          })),
          skipDuplicates: true,
        });
      }

      await transaction.organizationIdentity.update({
        where: { id: identity.id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
        },
      });

      if (user.status !== 'ACTIVE') {
        await transaction.user.update({
          where: { id: currentUserId },
          data: { status: 'ACTIVE' },
        });
      }

      await transaction.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      await transaction.auditLog.create({
        data: {
          organizationId: invitation.organizationId,
          actorId: currentUserId,
          action: AuditAction.ACCEPT_INVITATION,
          resourceType: 'Invitation',
          resourceId: invitation.id,
          description: `${user.email} a accepté l’invitation`,
          metadata: {
            organizationRoleCode: invitation.role.code,
            projectAssignments: invitation.projectAssignments.map(
              (assignment) => ({
                projectId: assignment.projectId,
                roleCode: assignment.role.code,
              }),
            ),
          },
        },
      });

      return member;
    });

    return {
      message: 'Invitation acceptée avec succès',
      member: result,
      projects: invitation.projectAssignments.map((assignment) => ({
        project: assignment.project,
        role: assignment.role,
      })),
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

    const newRole = await this.prisma.role.findFirst({
      where: {
        id: dto.roleId,
        scope: 'ORGANIZATION',
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
      await transaction.projectMember.deleteMany({
        where: {
          userId: member.user.id,
          project: {
            organizationId,
          },
        },
      });

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
      await transaction.projectMember.deleteMany({
        where: {
          userId: currentUserId,
          project: {
            organizationId,
          },
        },
      });

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

    if (membership.role.scope !== 'ORGANIZATION') {
      throw new ForbiddenException(
        'Le rôle associé à ce membre n’est pas un rôle organisation valide.',
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
    const role = await this.prisma.role.findFirst({
      where: {
        code,
        scope: 'ORGANIZATION',
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
    const membership =
      await this.ensureUserHasOrganizationRole(
        organizationId,
        currentUserId,
        ['OWNER', 'ADMIN'],
      );

    return this.prisma.role.findMany({
      where: {
        scope: 'ORGANIZATION',
        code: {
          in:
            membership.role.code === 'OWNER'
              ? ['ADMIN', 'MEMBER']
              : ['MEMBER'],
        },
      },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        scope: true,
      },
    });
  }

  async getAssignableProjectRoles(
    organizationId: string,
    currentUserId: string,
  ) {
    await this.ensureUserHasOrganizationRole(
      organizationId,
      currentUserId,
      ['OWNER', 'ADMIN'],
    );

    return this.prisma.role.findMany({
      where: {
        scope: 'PROJECT',
        code: {
          in: [
            'PROJECT_ADMIN',
            'MANAGER',
            'SECURITY_ANALYST',
            'DEVELOPER',
            'AUDITOR',
            'VIEWER',
          ],
        },
      },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        scope: true,
      },
    });
  }

  private hashToken(token: string): string {
    return createHash('sha256')
      .update(token)
      .digest('hex');
  }

  /**
   * Génère un mot de passe temporaire lisible (envoyé par email
   * à une personne invitée qui n'a pas encore de compte).
   */
  private generateTemporaryPassword(length = 12): string {
    const charset =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

    const bytes = randomBytes(length);

    let password = '';

    for (let i = 0; i < length; i += 1) {
      password += charset[bytes[i] % charset.length];
    }

    return password;
  }

  private async hashTemporaryPassword(
    value: string,
  ): Promise<string> {
    return argon2.hash(value, {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
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

  private async generateUniqueLogin(
    firstName: string,
    lastName: string,
    organizationSlug: string,
  ): Promise<string> {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '');

    const first = normalize(firstName);
    const last = normalize(lastName);
    const organization = organizationSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    const baseLocalPart =
      [first, last].filter(Boolean).join('.') || 'user';
    const domain = `${organization}.com`;

    let login = `${baseLocalPart}@${domain}`;
    let suffix = 1;

    while (
      await this.prisma.organizationIdentity.findUnique({
        where: { login },
        select: { id: true },
      })
    ) {
      suffix += 1;
      login = `${baseLocalPart}${suffix}@${domain}`;
    }

    return login;
  }

}

