import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditAction,
  FindingStatus,
  NotificationType,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

@Injectable()
export class FindingAssignmentsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Trouver le finding dans le bon tenant + projet
  |--------------------------------------------------------------------------
  */

  private async getFinding(
    organizationId: string,
    projectId: string,
    findingId: string,
  ) {
    const finding =
      await this.prisma.finding.findFirst({
        where: {
          id:
            findingId,

          projectId,

          repository: {
            organizationId,
          },
        },

        include: {
          repository: {
            select: {
              id:
                true,

              name:
                true,

              fullName:
                true,
            },
          },
        },
      });

    if (!finding) {
      throw new NotFoundException(
        'Finding introuvable.',
      );
    }

    return finding;
  }

  /*
  |--------------------------------------------------------------------------
  | Vérifier la personne assignée
  |--------------------------------------------------------------------------
  |
  | Elle doit :
  |
  | 1. appartenir à l'organisation ;
  | 2. appartenir explicitement au projet ;
  | 3. avoir un rôle PROJECT.
  |
  | Être simplement OrganizationMember n'est PAS suffisant.
  |
  */

  private async getAssignableProjectMember(
    organizationId: string,
    projectId: string,
    userId: string,
  ) {
    const organizationMember =
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
          },
        },
      });

    if (!organizationMember) {
      throw new BadRequestException(
        "L'utilisateur sélectionné n'est pas membre de l'organisation.",
      );
    }

    if (
      organizationMember.user
        .platformRole ===
      'PLATFORM_ADMIN'
    ) {
      throw new BadRequestException(
        'Un administrateur de la plateforme ne peut pas être assigné à un finding client.',
      );
    }

    if (
      organizationMember.user.status !==
      'ACTIVE'
    ) {
      throw new BadRequestException(
        "L'utilisateur sélectionné n'est pas actif.",
      );
    }

    const projectMember =
      await this.prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId,
          },
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
        },
      });

    if (!projectMember) {
      throw new BadRequestException(
        "L'utilisateur sélectionné n'est pas membre de ce projet.",
      );
    }

    if (
      projectMember.role.scope !==
      'PROJECT'
    ) {
      throw new BadRequestException(
        "Le rôle projet de l'utilisateur est invalide.",
      );
    }

    return {
      projectMember,

      user:
        organizationMember.user,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Assigner
  |--------------------------------------------------------------------------
  */

  async assign(
    organizationId: string,
    projectId: string,
    findingId: string,
    actorId: string,
    assignedToId: string,
  ) {
    const finding =
      await this.getFinding(
        organizationId,
        projectId,
        findingId,
      );

    const {
      user: assignedUser,
      projectMember,
    } =
      await this.getAssignableProjectMember(
        organizationId,
        projectId,
        assignedToId,
      );

    /*
    |--------------------------------------------------------------------------
    | Affectation déjà active identique
    |--------------------------------------------------------------------------
    */

    const currentAssignment =
      await this.prisma.findingAssignment.findFirst({
        where: {
          findingId,

          unassignedAt:
            null,
        },

        orderBy: {
          assignedAt:
            'desc',
        },
      });

    if (
      currentAssignment?.assignedToId ===
      assignedToId
    ) {
      return {
        assignment:
          currentAssignment,

        assignedTo:
          assignedUser,

        projectRole:
          projectMember.role,
      };
    }

    const assignment =
      await this.prisma.$transaction(
        async (transaction) => {
          /*
          |--------------------------------------------------------------------------
          | Fermer l'ancienne affectation
          |--------------------------------------------------------------------------
          */

          await transaction.findingAssignment.updateMany({
            where: {
              findingId,

              unassignedAt:
                null,
            },

            data: {
              unassignedAt:
                new Date(),
            },
          });

          /*
          |--------------------------------------------------------------------------
          | Nouvelle affectation
          |--------------------------------------------------------------------------
          */

          const created =
            await transaction.findingAssignment.create({
              data: {
                findingId,

                assignedToId,

                assignedById:
                  actorId,
              },
            });

          /*
          |--------------------------------------------------------------------------
          | Mettre automatiquement ASSIGNED
          |--------------------------------------------------------------------------
          */

          const shouldAssignStatus =
            finding.status ===
              FindingStatus.DETECTED ||
            finding.status ===
              FindingStatus.TO_REVIEW ||
            finding.status ===
              FindingStatus.CONFIRMED ||
            finding.status ===
              FindingStatus.REOPENED;

          if (
            shouldAssignStatus
          ) {
            await transaction.finding.update({
              where: {
                id:
                  findingId,
              },

              data: {
                status:
                  FindingStatus.ASSIGNED,

                resolvedAt:
                  null,
              },
            });
          }

          /*
          |--------------------------------------------------------------------------
          | Notification
          |--------------------------------------------------------------------------
          */

          await transaction.notification.create({
            data: {
              userId:
                assignedToId,

              type:
                NotificationType.FINDING_ASSIGNED,

              title:
                'Finding assigné',

              message:
                `Le finding "${finding.title}" vous a été assigné.`,

              metadata: {
                organizationId,

                projectId,

                repositoryId:
                  finding.repositoryId,

                findingId,

                assignmentId:
                  created.id,

                projectRole:
                  projectMember.role.code,
              },
            },
          });

          /*
          |--------------------------------------------------------------------------
          | Audit
          |--------------------------------------------------------------------------
          */

          await transaction.auditLog.create({
            data: {
              organizationId,

              projectId,

              actorId,

              action:
                AuditAction.ASSIGN,

              resourceType:
                'Finding',

              resourceId:
                findingId,

              description:
                `Finding assigné à ${assignedUser.email}`,

              metadata: {
                assignedToId,

                assignmentId:
                  created.id,

                repositoryId:
                  finding.repositoryId,

                projectRole:
                  projectMember.role.code,

                previousAssignedToId:
                  currentAssignment?.assignedToId ??
                  null,
              },
            },
          });

          return created;
        },
      );

    return {
      assignment,

      assignedTo:
        assignedUser,

      projectRole:
        projectMember.role,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Retirer l'affectation
  |--------------------------------------------------------------------------
  */

  async unassign(
    organizationId: string,
    projectId: string,
    findingId: string,
    actorId: string,
  ) {
    const finding =
      await this.getFinding(
        organizationId,
        projectId,
        findingId,
      );

    const active =
      await this.prisma.findingAssignment.findFirst({
        where: {
          findingId,

          unassignedAt:
            null,
        },

        orderBy: {
          assignedAt:
            'desc',
        },
      });

    if (!active) {
      return {
        success:
          true,
      };
    }

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.findingAssignment.update({
          where: {
            id:
              active.id,
          },

          data: {
            unassignedAt:
              new Date(),
          },
        });

        /*
        |--------------------------------------------------------------------------
        | Retour vers CONFIRMED
        |--------------------------------------------------------------------------
        */

        if (
          finding.status ===
          FindingStatus.ASSIGNED
        ) {
          await transaction.finding.update({
            where: {
              id:
                findingId,
            },

            data: {
              status:
                FindingStatus.CONFIRMED,

              resolvedAt:
                null,
            },
          });
        }

        await transaction.auditLog.create({
          data: {
            organizationId,

            projectId,

            actorId,

            action:
              AuditAction.UPDATE,

            resourceType:
              'FindingAssignment',

            resourceId:
              active.id,

            description:
              'Affectation retirée',

            metadata: {
              findingId,

              assignedToId:
                active.assignedToId,

              repositoryId:
                finding.repositoryId,
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

  /*
  |--------------------------------------------------------------------------
  | Affectation active
  |--------------------------------------------------------------------------
  */

  async getActive(
    organizationId: string,
    projectId: string,
    findingId: string,
  ) {
    await this.getFinding(
      organizationId,
      projectId,
      findingId,
    );

    return this.prisma.findingAssignment.findFirst({
      where: {
        findingId,

        unassignedAt:
          null,
      },

      orderBy: {
        assignedAt:
          'desc',
      },

      include: {
        assignedTo: {
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

        assignedBy: {
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
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Mes tâches dans un projet précis
  |--------------------------------------------------------------------------
  */

  async startWork(
    organizationId: string,
    projectId: string,
    findingId: string,
    currentUserId: string,
  ) {
    const finding =
      await this.getFinding(
        organizationId,
        projectId,
        findingId,
      );

    const activeAssignment =
      await this.prisma.findingAssignment.findFirst({
        where: {
          findingId,
          assignedToId:
            currentUserId,
          unassignedAt:
            null,
        },

        select: {
          id:
            true,
        },
      });

    if (!activeAssignment) {
      throw new BadRequestException(
        "Cette tâche ne vous est pas affectée.",
      );
    }

    if (
      finding.status !==
        FindingStatus.ASSIGNED &&
      finding.status !==
        FindingStatus.REOPENED
    ) {
      throw new BadRequestException(
        `Impossible de commencer cette tâche depuis le statut ${finding.status}.`,
      );
    }

    const now =
      new Date();

    const updatedFinding =
      await this.prisma.$transaction(
        async transaction => {
          const updated =
            await transaction.finding.update({
              where: {
                id:
                  findingId,
              },

              data: {
                status:
                  FindingStatus.IN_PROGRESS,

                resolvedAt:
                  null,

                metadata: {
                  ...(
                    (
                      finding.metadata ??
                      {}
                    ) as Record<
                      string,
                      unknown
                    >
                  ),

                  workStartedBy:
                    currentUserId,

                  workStartedAt:
                    now.toISOString(),
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
                AuditAction.CHANGE_STATUS,
              resourceType:
                'Finding',
              resourceId:
                findingId,
              description:
                'Correction du finding commencée par la personne assignée.',
              metadata: {
                assignmentId:
                  activeAssignment.id,
                previousStatus:
                  finding.status,
                newStatus:
                  FindingStatus.IN_PROGRESS,
                repositoryId:
                  finding.repositoryId,
              },
            },
          });

          return updated;
        },
      );

    return {
      message:
        'La correction est maintenant en cours.',
      finding:
        updatedFinding,
    };
  }

  async markReadyForRetest(
    organizationId: string,
    projectId: string,
    findingId: string,
    currentUserId: string,
  ) {
    const finding =
      await this.getFinding(
        organizationId,
        projectId,
        findingId,
      );

    const activeAssignment =
      await this.prisma.findingAssignment.findFirst({
        where: {
          findingId,

          assignedToId:
            currentUserId,

          unassignedAt:
            null,
        },

        select: {
          id:
            true,

          assignedById:
            true,

          assignedToId:
            true,
        },
      });

    if (
      !activeAssignment
    ) {
      throw new BadRequestException(
        "Cette tâche ne vous est pas affectée.",
      );
    }

    if (
      finding.status !==
        FindingStatus.IN_PROGRESS
    ) {
      throw new BadRequestException(
        `Impossible de signaler cette tâche comme corrigée depuis le statut ${finding.status}.`,
      );
    }

    const responsibleMembers =
      await this.prisma.projectMember.findMany({
        where: {
          projectId,

          project: {
            organizationId,
          },

          role: {
            scope:
              'PROJECT',

            code: {
              in: [
                'PROJECT_ADMIN',
                'MANAGER',
              ],
            },
          },

          user: {
            status:
              'ACTIVE',

            platformRole: {
              not:
                'PLATFORM_ADMIN',
            },
          },
        },

        select: {
          userId:
            true,
        },
      });

    const recipientIds =
      new Set<string>(
        responsibleMembers.map(
          member =>
            member.userId,
        ),
      );

    /*
    * Toujours prévenir également la personne
    * ayant créé l’affectation.
    */
    recipientIds.add(
      activeAssignment.assignedById,
    );

    /*
    * Ne pas notifier l’utilisateur lui-même.
    */
    recipientIds.delete(
      currentUserId,
    );

    const now =
      new Date();

    const updatedFinding =
      await this.prisma.$transaction(
        async transaction => {
          const updated =
            await transaction.finding.update({
              where: {
                id:
                  findingId,
              },

              data: {
                status:
                  FindingStatus.READY_FOR_RETEST,

                resolvedAt:
                  null,

                metadata: {
                  ...(
                    (
                      finding.metadata ??
                      {}
                    ) as Record<
                      string,
                      unknown
                    >
                  ),

                  readyForRetestBy:
                    currentUserId,

                  readyForRetestAt:
                    now.toISOString(),
                },
              },
            });

          for (
            const recipientId of
            recipientIds
          ) {
            await transaction.notification.create({
              data: {
                userId:
                  recipientId,

                type:
                  NotificationType.FINDING_UPDATED,

                title:
                  'Finding prêt pour validation',

                message:
                  `Le finding "${finding.title}" a été signalé comme corrigé et doit être vérifié.`,

                metadata: {
                  organizationId,

                  projectId,

                  findingId,

                  repositoryId:
                    finding.repositoryId,

                  assignmentId:
                    activeAssignment.id,

                  previousStatus:
                    finding.status,

                  newStatus:
                    FindingStatus.READY_FOR_RETEST,

                  reportedById:
                    currentUserId,
                },
              },
            });
          }

          await transaction.auditLog.create({
            data: {
              organizationId,

              projectId,

              actorId:
                currentUserId,

              action:
                AuditAction.CHANGE_STATUS,

              resourceType:
                'Finding',

              resourceId:
                findingId,

              description:
                'Finding signalé comme corrigé et prêt pour retest.',

              metadata: {
                assignmentId:
                  activeAssignment.id,

                previousStatus:
                  finding.status,

                newStatus:
                  FindingStatus.READY_FOR_RETEST,

                repositoryId:
                  finding.repositoryId,
              },
            },
          });

          return updated;
        },
      );

    return {
      message:
        'Le finding a été signalé comme corrigé. Un responsable a été notifié.',

      finding:
        updatedFinding,
    };
  }


  async myTasks(
    organizationId: string,
    projectId: string,
    userId: string,
  ) {
    return this.prisma.findingAssignment.findMany({
      where: {
        assignedToId:
          userId,

        unassignedAt:
          null,

        finding: {
          projectId,

          repository: {
            organizationId,
          },
        },
      },

      orderBy: {
        assignedAt:
          'desc',
      },

      include: {
        finding: {
          include: {
            repository: {
              select: {
                id:
                  true,

                name:
                  true,

                fullName:
                  true,
              },
            },
          },
        },
      },
    });
  }
}
