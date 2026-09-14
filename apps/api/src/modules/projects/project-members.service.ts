import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditAction,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  PERMISSION_CODES,
  RbacService,
} from '../rbac';

import type {
  ProjectRoleCode,
} from './dto/add-project-member.dto';

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly rbacService:
      RbacService,
  ) {}

  async findAll(
    organizationId: string,
    projectId: string,
  ) {
    await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    return this.prisma.projectMember.findMany({
      where: {
        projectId,

        project: {
          organizationId,
        },
      },

      orderBy: {
        createdAt:
          'asc',
      },

      select: {
        id: true,
        projectId: true,
        userId: true,
        roleId: true,
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
          },
        },

        role: {
          select: {
            id: true,
            code: true,
            name: true,
            description: true,
            scope: true,
          },
        },
      },
    });
  }

  async findAvailableRoles(
    organizationId: string,
    projectId: string,
  ) {
    await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    return this.prisma.role.findMany({
      where: {
        scope:
          'PROJECT',

        isSystem:
          true,

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

      orderBy: {
        name:
          'asc',
      },

      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        scope: true,

        permissions: {
          select: {
            permission: {
              select: {
                code: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });
  }

  async add(
    organizationId:
      string,

    projectId:
      string,

    currentUserId:
      string,

    targetUserId:
      string,

    roleCode:
      ProjectRoleCode,
  ) {
    await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    await this.rbacService.requireProjectPermission(
      organizationId,
      projectId,
      currentUserId,
      PERMISSION_CODES.PROJECT_MEMBER_MANAGE,
    );

    const actor =
      await this.getActorContext(
        organizationId,
        projectId,
        currentUserId,
      );

    const targetOrganizationMember =
      await this.getEligibleOrganizationMember(
        organizationId,
        targetUserId,
      );

    const role =
      await this.getProjectRole(
        roleCode,
      );

    this.ensureRoleAssignmentAllowed(
      actor,
      role.code,
    );

    const existingMembership =
      await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId:
              targetUserId,
          },
        },

        select: {
          id:
            true,
        },
      });

    if (
      existingMembership
    ) {
      throw new ConflictException(
        'Cet utilisateur est déjà membre du projet.',
      );
    }

    return this.prisma.$transaction(
      async transaction => {
        const membership =
          await transaction.projectMember.create({
            data: {
              projectId,

              userId:
                targetUserId,

              roleId:
                role.id,
            },

            select: {
              id: true,
              projectId: true,
              userId: true,
              roleId: true,
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
                },
              },

              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  description: true,
                  scope: true,
                },
              },
            },
          });

        await transaction.auditLog.create({
          data: {
            organizationId,

            projectId,

            actorId:
              currentUserId,

            action:
              AuditAction.CREATE,

            resourceType:
              'ProjectMember',

            resourceId:
              membership.id,

            description:
              `Utilisateur "${targetOrganizationMember.user.firstName} ${targetOrganizationMember.user.lastName}" ajouté au projet avec le rôle ${role.code}`,

            metadata: {
              targetUserId,

              roleId:
                role.id,

              roleCode:
                role.code,
            },
          },
        });

        return membership;
      },
    );
  }

  async updateRole(
    organizationId:
      string,

    projectId:
      string,

    targetUserId:
      string,

    currentUserId:
      string,

    roleCode:
      ProjectRoleCode,
  ) {
    await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    await this.rbacService.requireProjectPermission(
      organizationId,
      projectId,
      currentUserId,
      PERMISSION_CODES.PROJECT_MEMBER_MANAGE,
    );

    const actor =
      await this.getActorContext(
        organizationId,
        projectId,
        currentUserId,
      );

    await this.getEligibleOrganizationMember(
      organizationId,
      targetUserId,
    );

    const membership =
      await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,

            userId:
              targetUserId,
          },
        },

        select: {
          id: true,
          userId: true,
          roleId: true,

          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },

          role: {
            select: {
              id: true,
              code: true,
              scope: true,
            },
          },
        },
      });

    if (!membership) {
      throw new NotFoundException(
        "Ce membre n'est pas affecté au projet.",
      );
    }

    if (
      membership.role.scope !==
      'PROJECT'
    ) {
      throw new ForbiddenException(
        "Le rôle actuel du membre n'est pas un rôle projet valide.",
      );
    }

    this.ensureTargetCanBeManaged(
      actor,
      membership.role.code,
    );

    const newRole =
      await this.getProjectRole(
        roleCode,
      );

    this.ensureRoleAssignmentAllowed(
      actor,
      newRole.code,
    );

    if (
      membership.roleId ===
      newRole.id
    ) {
      return this.prisma.projectMember.findUniqueOrThrow({
        where: {
          id:
            membership.id,
        },

        select: {
          id: true,
          projectId: true,
          userId: true,
          roleId: true,
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
            },
          },

          role: {
            select: {
              id: true,
              code: true,
              name: true,
              description: true,
              scope: true,
            },
          },
        },
      });
    }

    return this.prisma.$transaction(
      async transaction => {
        const updated =
          await transaction.projectMember.update({
            where: {
              id:
                membership.id,
            },

            data: {
              roleId:
                newRole.id,
            },

            select: {
              id: true,
              projectId: true,
              userId: true,
              roleId: true,
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
                },
              },

              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  description: true,
                  scope: true,
                },
              },
            },
          });

        await transaction.auditLog.create({
          data: {
            organizationId,

            projectId,

            actorId:
              currentUserId,

            action:
              AuditAction.UPDATE,

            resourceType:
              'ProjectMember',

            resourceId:
              membership.id,

            description:
              `Rôle de "${membership.user.firstName} ${membership.user.lastName}" modifié de ${membership.role.code} vers ${newRole.code}`,

            metadata: {
              targetUserId,

              previousRoleId:
                membership.role.id,

              previousRoleCode:
                membership.role.code,

              newRoleId:
                newRole.id,

              newRoleCode:
                newRole.code,
            },
          },
        });

        return updated;
      },
    );
  }

  async remove(
    organizationId:
      string,

    projectId:
      string,

    targetUserId:
      string,

    currentUserId:
      string,
  ) {
    await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    await this.rbacService.requireProjectPermission(
      organizationId,
      projectId,
      currentUserId,
      PERMISSION_CODES.PROJECT_MEMBER_MANAGE,
    );

    const actor =
      await this.getActorContext(
        organizationId,
        projectId,
        currentUserId,
      );

    const membership =
      await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,

            userId:
              targetUserId,
          },
        },

        select: {
          id: true,
          userId: true,

          role: {
            select: {
              code: true,
              scope: true,
            },
          },

          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      });

    if (!membership) {
      throw new NotFoundException(
        "Ce membre n'est pas affecté au projet.",
      );
    }

    if (
      membership.role.scope !==
      'PROJECT'
    ) {
      throw new ForbiddenException(
        "Le rôle du membre n'est pas un rôle projet valide.",
      );
    }

    this.ensureTargetCanBeManaged(
      actor,
      membership.role.code,
    );

    /*
     * Évite qu'un MANAGER supprime lui-même son propre accès
     * par erreur via une future interface.
     *
     * OWNER et PROJECT_ADMIN peuvent toujours gérer leur propre
     * membership si nécessaire.
     */
    if (
      targetUserId === currentUserId &&
      !actor.isOwner &&
      actor.projectRoleCode !==
        'PROJECT_ADMIN'
    ) {
      throw new ForbiddenException(
        'Vous ne pouvez pas retirer votre propre accès projet.',
      );
    }

    await this.prisma.$transaction(
      async transaction => {
        await transaction.auditLog.create({
          data: {
            organizationId,

            projectId,

            actorId:
              currentUserId,

            action:
              AuditAction.DELETE,

            resourceType:
              'ProjectMember',

            resourceId:
              membership.id,

            description:
              `Utilisateur "${membership.user.firstName} ${membership.user.lastName}" retiré du projet`,

            metadata: {
              targetUserId,

              previousRoleCode:
                membership.role.code,
            },
          },
        });

        await transaction.projectMember.delete({
          where: {
            id:
              membership.id,
          },
        });
      },
    );

    return {
      message:
        'Membre retiré du projet avec succès.',
    };
  }

  private async ensureProjectExists(
    organizationId:
      string,

    projectId:
      string,
  ) {
    const project =
      await this.prisma.project.findFirst({
        where: {
          id:
            projectId,

          organizationId,
        },

        select: {
          id:
            true,

          organizationId:
            true,
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable.',
      );
    }

    return project;
  }

  private async getProjectRole(
    roleCode:
      ProjectRoleCode,
  ) {
    const role =
      await this.prisma.role.findFirst({
        where: {
          code:
            roleCode,

          scope:
            'PROJECT',

          isSystem:
            true,
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

    if (!role) {
      throw new NotFoundException(
        `Le rôle projet ${roleCode} est introuvable.`,
      );
    }

    return role;
  }

  private async getEligibleOrganizationMember(
    organizationId:
      string,

    userId:
      string,
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
          id:
            true,

          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              platformRole: true,
            },
          },

          role: {
            select: {
              code: true,
              scope: true,
            },
          },
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        "L'utilisateur doit être membre de l'organisation avant d'être affecté au projet.",
      );
    }

    if (
      membership.role.scope !==
      'ORGANIZATION'
    ) {
      throw new ForbiddenException(
        "Le rôle organisationnel de l'utilisateur est invalide.",
      );
    }

    if (
      membership.user.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      throw new ForbiddenException(
        'Un administrateur plateforme ne peut pas être membre d’un projet client.',
      );
    }

    if (
      membership.user.status !==
      'ACTIVE'
    ) {
      throw new ConflictException(
        "Le compte utilisateur doit être actif avant son affectation au projet.",
      );
    }

    const identity =
      await this.prisma.organizationIdentity.findUnique({
        where: {
          organizationId_userId: {
            organizationId,

            userId,
          },
        },

        select: {
          id:
            true,

          status:
            true,
        },
      });

    if (!identity) {
      throw new ConflictException(
        'L’identité professionnelle de cet utilisateur est introuvable.',
      );
    }

    if (
      identity.status !==
      'ACTIVE'
    ) {
      throw new ConflictException(
        'L’identité professionnelle doit être active avant l’affectation au projet.',
      );
    }

    return membership;
  }

  private async getActorContext(
    organizationId:
      string,

    projectId:
      string,

    currentUserId:
      string,
  ) {
    const organizationMembership =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,

            userId:
              currentUserId,
          },
        },

        select: {
          id:
            true,

          role: {
            select: {
              code:
                true,

              scope:
                true,
            },
          },
        },
      });

    if (
      !organizationMembership
    ) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de cette organisation.",
      );
    }

    if (
      organizationMembership.role.scope !==
      'ORGANIZATION'
    ) {
      throw new ForbiddenException(
        "Votre rôle d'organisation est invalide.",
      );
    }

    if (
      organizationMembership.role.code ===
      'OWNER'
    ) {
      return {
        isOwner:
          true as const,

        projectRoleCode:
          null,
      };
    }

    const projectMembership =
      await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,

            userId:
              currentUserId,
          },
        },

        select: {
          id:
            true,

          role: {
            select: {
              code:
                true,

              scope:
                true,
            },
          },
        },
      });

    if (
      !projectMembership
    ) {
      throw new ForbiddenException(
        "Vous n'êtes pas affecté à ce projet.",
      );
    }

    if (
      projectMembership.role.scope !==
      'PROJECT'
    ) {
      throw new ForbiddenException(
        'Votre rôle projet est invalide.',
      );
    }

    return {
      isOwner:
        false as const,

      projectRoleCode:
        projectMembership.role.code,
    };
  }

  private ensureRoleAssignmentAllowed(
    actor: {
      isOwner:
        boolean;

      projectRoleCode:
        string | null;
    },

    roleCode:
      string,
  ): void {
    if (
      actor.isOwner
    ) {
      return;
    }

    if (
      actor.projectRoleCode ===
      'PROJECT_ADMIN'
    ) {
      return;
    }

    if (
      roleCode ===
      'PROJECT_ADMIN'
    ) {
      throw new ForbiddenException(
        'Seul le OWNER ou un PROJECT_ADMIN peut attribuer le rôle PROJECT_ADMIN.',
      );
    }
  }

  private ensureTargetCanBeManaged(
    actor: {
      isOwner:
        boolean;

      projectRoleCode:
        string | null;
    },

    targetRoleCode:
      string,
  ): void {
    if (
      actor.isOwner
    ) {
      return;
    }

    if (
      actor.projectRoleCode ===
      'PROJECT_ADMIN'
    ) {
      return;
    }

    if (
      targetRoleCode ===
      'PROJECT_ADMIN'
    ) {
      throw new ForbiddenException(
        'Seul le OWNER ou un PROJECT_ADMIN peut modifier ou retirer un PROJECT_ADMIN.',
      );
    }
  }
}
