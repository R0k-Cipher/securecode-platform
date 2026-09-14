import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  FindingStatus,
  PlatformRole,
  ScanStatus,
  UserStatus,
  WebhookEventStatus,
  RepositorySyncStatus,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';



@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly prisma: PrismaService,
    
  ) {}

async dashboard() {
  const since24h =
    new Date(
      Date.now() -
      24 * 60 * 60 * 1000,
    );

  const [
    users,
    activeUsers,
    organizations,
    projects,
    repositories,
    pendingInvitations,
    activeGitConnections,
    gitConnectionErrors,
    auditEvents24h,
    activeSessions,
    latestUsers,
    latestAuditLogs,
  ] =
    await this.prisma
      .$transaction([
        this.prisma.user.count(),

        this.prisma.user.count({
          where: {
            status:
              UserStatus.ACTIVE,
          },
        }),

        this.prisma.organization.count(),

        this.prisma.project.count(),

        this.prisma.repository.count(),

        this.prisma.invitation.count({
          where: {
            acceptedAt:
              null,

            revokedAt:
              null,

            expiresAt: {
              gt:
                new Date(),
            },
          },
        }),

        this.prisma.gitConnection.count({
          where: {
            status:
              'ACTIVE',
          },
        }),

        this.prisma.gitConnection.count({
          where: {
            status:
              'ERROR',
          },
        }),

        this.prisma.auditLog.count({
          where: {
            createdAt: {
              gte:
                since24h,
            },
          },
        }),

        this.prisma.session.count({
          where: {
            revokedAt:
              null,

            expiresAt: {
              gt:
                new Date(),
            },
          },
        }),

        this.prisma.user.findMany({
          take:
            6,

          orderBy: {
            createdAt:
              'desc',
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

            lastLoginAt:
              true,

            createdAt:
              true,

            _count: {
              select: {
                organizationMemberships:
                  true,

                createdProjects:
                  true,
              },
            },
          },
        }),

        this.prisma.auditLog.findMany({
          take:
            8,

          orderBy: {
            createdAt:
              'desc',
          },

          select: {
            id:
              true,

            action:
              true,

            resourceType:
              true,

            resourceId:
              true,

            description:
              true,

            ipAddress:
              true,

            createdAt:
              true,

            actor: {
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

            organization: {
              select: {
                id:
                  true,

                name:
                  true,
              },
            },

            project: {
              select: {
                id:
                  true,

                name:
                  true,
              },
            },
          },
        }),
      ]);

  return {
    summary: {
      users,
      activeUsers,
      organizations,
      projects,
      repositories,
      pendingInvitations,
      activeGitConnections,
      gitConnectionErrors,
      auditEvents24h,
      activeSessions,
    },

    latestUsers,

    latestAuditLogs,
  };
}

async listAuditLogs() {
  return this.prisma.auditLog.findMany({
    take:
      500,

    orderBy: {
      createdAt:
        'desc',
    },

    select: {
      id:
        true,

      action:
        true,

      resourceType:
        true,

      resourceId:
        true,

      description:
        true,

      ipAddress:
        true,

      userAgent:
        true,

      metadata:
        true,

      createdAt:
        true,

      actor: {
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
    },
  });
}

  listUsers() {
    return this.prisma.user
      .findMany({
        orderBy: {
          createdAt: 'desc',
        },

        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          platformRole: true,
          lastLoginAt: true,
          createdAt: true,

          _count: {
            select: {
              organizationMemberships:
                true,

              createdProjects:
                true,
            },
          },
        },
      });
  }

  listOrganizations() {
    return this.prisma.organization
      .findMany({
        orderBy: {
          createdAt: 'desc',
        },

        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          createdAt: true,

          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },

          _count: {
            select: {
              members: true,
              projects: true,
              repositories: true,
            },
          },
        },
      });
  }

  listProjects() {
    return this.prisma.project
      .findMany({
        orderBy: {
          createdAt: 'desc',
        },

        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          createdAt: true,

          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },

          createdBy: {
            select: {
              id: true,
              email: true,
            },
          },

          _count: {
            select: {
              repositories: true,
              scans: true,
              findings: true,
              members: true,
            },
          },
        },
      });
  }

  async listScans() {
    const scans =
      await this.prisma.scan
        .findMany({
          take: 250,

          orderBy: {
            createdAt: 'desc',
          },

          select: {
            id: true,
            type: true,
            trigger: true,
            status: true,
            branch: true,
            commitSha: true,
            score: true,
            progress: true,
            queuedAt: true,
            startedAt: true,
            completedAt: true,
            failedAt: true,
            errorMessage: true,

            project: {
              select: {
                id: true,
                name: true,
              },
            },

            repository: {
              select: {
                id: true,
                fullName: true,
              },
            },

            requestedBy: {
              select: {
                id: true,
                email: true,
              },
            },

            _count: {
              select: {
                findings: true,
              },
            },
          },
        });

    return scans.map(
      (scan) => ({
        ...scan,

        score:
          scan.score === null
            ? null
            : Number(
                scan.score,
              ),
      }),
    );
  }

  async systemStatus() {
    let databaseStatus:
      'UP' | 'DOWN' =
      'UP';

    try {
      await this.prisma
        .$queryRaw`
          SELECT 1
        `;
    } catch {
      databaseStatus =
        'DOWN';
    }

    const [
      queuedScans,
      runningScans,
      failedScans,
      queuedSyncs,
      runningSyncs,
      failedSyncs,
      receivedWebhooks,
      failedWebhooks,
    ] =
      await this.prisma
        .$transaction([
          this.prisma.scan
            .count({
              where: {
                status:
                  ScanStatus.QUEUED,
              },
            }),

          this.prisma.scan
            .count({
              where: {
                status: {
                  in: [
                    ScanStatus.PREPARING,
                    ScanStatus.DOWNLOADING,
                    ScanStatus.DETECTING,
                    ScanStatus.SCANNING,
                    ScanStatus.PROCESSING_RESULTS,
                    ScanStatus.CALCULATING_SCORE,
                    ScanStatus.GENERATING_REPORT,
                  ],
                },
              },
            }),

          this.prisma.scan
            .count({
              where: {
                status:
                  ScanStatus.FAILED,
              },
            }),

          this.prisma.repositorySync
            .count({
              where: {
                status: {
                  in: [
                    RepositorySyncStatus.PENDING,
                    RepositorySyncStatus.QUEUED,
                  ],
                },
              },
            }),

          this.prisma.repositorySync
            .count({
              where: {
                status:
                  RepositorySyncStatus.RUNNING,
              },
            }),

          this.prisma.repositorySync
            .count({
              where: {
                status:
                  RepositorySyncStatus.FAILED,
              },
            }),

          this.prisma.webhookEvent
            .count({
              where: {
                status:
                  WebhookEventStatus.RECEIVED,
              },
            }),

          this.prisma.webhookEvent
            .count({
              where: {
                status:
                  WebhookEventStatus.FAILED,
              },
            }),
        ]);

    const degraded =
      databaseStatus ===
        'DOWN' ||
      failedScans >
        0 ||
      failedSyncs >
        0 ||
      failedWebhooks >
        0;

    return {
      status:
        degraded
          ? 'DEGRADED'
          : 'HEALTHY',

      timestamp:
        new Date()
          .toISOString(),

      uptimeSeconds:
        Math.floor(
          process.uptime(),
        ),

      database: {
        status:
          databaseStatus,
      },

      scans: {
        queued:
          queuedScans,

        running:
          runningScans,

        failed:
          failedScans,
      },

      repositorySyncs: {
        queued:
          queuedSyncs,

        running:
          runningSyncs,

        failed:
          failedSyncs,
      },

      webhooks: {
        received:
          receivedWebhooks,

        failed:
          failedWebhooks,
      },
    };
  }

  async setUserStatus(
    id: string,
    status: UserStatus,
  ) {
    const user =
      await this.prisma.user
        .findUnique({
          where: {
            id,
          },

          select: {
            id: true,
          },
        });

    if (!user) {
      throw new NotFoundException(
        'Utilisateur introuvable.',
      );
    }

    return this.prisma.user
      .update({
        where: {
          id,
        },

        data: {
          status,
        },

        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          platformRole: true,
          lastLoginAt: true,
          createdAt: true,

          _count: {
            select: {
              organizationMemberships:
                true,

              createdProjects:
                true,
            },
          },
        },
      });
  }

  async setUserRole(
    id: string,
    platformRole:
      PlatformRole,
  ) {
    const user =
      await this.prisma.user
        .findUnique({
          where: {
            id,
          },

          select: {
            id: true,
          },
        });

    if (!user) {
      throw new NotFoundException(
        'Utilisateur introuvable.',
      );
    }

    return this.prisma.user
      .update({
        where: {
          id,
        },

        data: {
          platformRole,
        },

        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          platformRole: true,
          lastLoginAt: true,
          createdAt: true,

          _count: {
            select: {
              organizationMemberships:
                true,

              createdProjects:
                true,
            },
          },
        },
      });
  }
}
