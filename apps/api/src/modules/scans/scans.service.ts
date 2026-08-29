import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  InjectQueue,
} from '@nestjs/bullmq';

import type {
  Queue,
} from 'bullmq';

import {
  randomUUID,
} from 'node:crypto';

import {
  AuditAction,
  GitProvider,
  Prisma,
  ScanStatus,
  ScanTrigger,
  ScanType,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  JOB_NAMES,
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';

import type {
  SecurityScanJobData,
} from '@securecode-platform/queue-contracts';
import { ListScansDto } from './dto/list-scans.dto';




@Injectable()
export class ScansService {
  constructor(
    private readonly prisma:
      PrismaService,

    @InjectQueue(
      QUEUE_NAMES.SECURITY_SCAN,
    )
    private readonly scanQueue:
      Queue,
  ) {}

  async createManualScan(
    organizationId:
      string,

    projectId:
      string,

    repositoryId:
      string,

    userId:
      string,
  ) {
    const repository =
      await this.prisma
        .repository
        .findFirst({
          where: {
            id:
              repositoryId,

            organizationId,

            projectId,

            isArchived:
              false,
          },

          select: {
            id:
              true,

            projectId:
              true,

            gitConnectionId:
              true,

            provider:
              true,

            externalId:
              true,

            fullName:
              true,

            defaultBranch:
              true,

            lastRemoteCommitSha:
              true,
          },
        });

    if (!repository) {
      throw new NotFoundException(
        'Repository introuvable.',
      );
    }

    if (
      !repository.defaultBranch ||
      !repository.lastRemoteCommitSha
    ) {
      throw new ConflictException(
        "Le repository n'a pas encore été synchronisé.",
      );
    }

    const correlationId =
      randomUUID();

    const scan =
      await this.prisma.scan.create({
        data: {
          projectId,

          repositoryId,

          requestedById:
            userId,

          type:
            ScanType.MANUAL_SCAN,

          trigger:
            ScanTrigger.MANUAL,

          status:
            ScanStatus.QUEUED,

          branch:
            repository.defaultBranch,

          commitSha:
            repository.lastRemoteCommitSha,

          progress:
            0,

          configuration: {
            requestedMode:
              'AUTO',

            correlationId,
          },
        },
      });

    const jobData:
      SecurityScanJobData = {
        organizationId,

        projectId,

        repositoryId,

        scanId:
          scan.id,

        gitConnectionId:
          repository.gitConnectionId,

        provider:
          repository.provider ===
          GitProvider.GITHUB
            ? 'GITHUB'
            : 'GITLAB',

        repositoryExternalId:
          repository.externalId,

        repositoryFullName:
          repository.fullName,

        branch:
          repository.defaultBranch,

        fromSha:
          null,

        toSha:
          repository.lastRemoteCommitSha,

        pullRequestId:
          null,

        requestedMode:
          'AUTO',

        trigger:
          'MANUAL',

        triggeredById:
          userId,

        eventId:
          null,

        requestedAt:
          new Date().toISOString(),

        correlationId,
      };

    try {
      const job =
        await this.scanQueue.add(
          JOB_NAMES.SECURITY_SCAN,
          jobData,
          {
            jobId: `security-scan-${scan.id}`,

            attempts:
              2,

            backoff: {
              type:
                'exponential',

              delay:
                5_000,
            },

            removeOnComplete:
              100,

            removeOnFail:
              500,
          },
        );

      await this.prisma
        .scan
        .update({
          where: {
            id:
              scan.id,
          },

          data: {
            queueJobId:
              job.id
                ? String(
                    job.id,
                  )
                : null,
          },
        });

      return {
        scanId:
          scan.id,

        repositoryId,

        status:
          ScanStatus.QUEUED,

        correlationId,
      };
    } catch (
      error
    ) {
      await this.prisma
        .scan
        .update({
          where: {
            id:
              scan.id,
          },

          data: {
            status:
              ScanStatus.FAILED,

            failedAt:
              new Date(),

            errorMessage:
              'Impossible de planifier le scan.',
          },
        });

      throw error;
    }
  }

  async listProjectScans(
    organizationId: string,
    projectId: string,
    query: ListScansDto,
  ) {
    await this.assertProject(
      organizationId,
      projectId,
    );

    const where:
      Prisma.ScanWhereInput = {
      projectId,

      repository: {
        organizationId,
      },

      ...(query.status
        ? {
            status:
              query.status,
          }
        : {}),

      ...(query.type
        ? {
            type:
              query.type,
          }
        : {}),

      ...(query.trigger
        ? {
            trigger:
              query.trigger,
          }
        : {}),
    };

    const skip =
      (query.page - 1) *
      query.perPage;

    const [
      total,
      scans,
    ] =
      await this.prisma.$transaction([
        this.prisma.scan.count({
          where,
        }),

        this.prisma.scan.findMany({
          where,

          orderBy: {
            createdAt:
              'desc',
          },

          skip,

          take:
            query.perPage,

          select: {
            id:
              true,

            type:
              true,

            trigger:
              true,

            status:
              true,

            branch:
              true,

            commitSha:
              true,

            progress:
              true,

            score:
              true,

            startedAt:
              true,

            completedAt:
              true,

            failedAt:
              true,

            createdAt:
              true,

            errorMessage:
              true,

            statistics:
              true,

            repository: {
              select: {
                id:
                  true,

                name:
                  true,

                fullName:
                  true,

                provider:
                  true,

                primaryLanguage:
                  true,
              },
            },

            _count: {
              select: {
                findings:
                  true,
              },
            },
          },
        }),
      ]);

    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total /
            query.perPage,
        ),
      );

    return {
      items:
        scans,

      pagination: {
        page:
          query.page,

        perPage:
          query.perPage,

        total,

        totalPages,

        hasNextPage:
          query.page <
          totalPages,

        hasPreviousPage:
          query.page >
          1,
      },
    };
  }

  async listRepositoryScans(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    query: ListScansDto,
  ) {
    await this.assertRepository(
      organizationId,
      projectId,
      repositoryId,
    );

    const where:
      Prisma.ScanWhereInput = {
      projectId,
      repositoryId,

      ...(query.status
        ? {
            status:
              query.status,
          }
        : {}),

      ...(query.type
        ? {
            type:
              query.type,
          }
        : {}),

      ...(query.trigger
        ? {
            trigger:
              query.trigger,
          }
        : {}),
    };

    const [
      total,
      items,
    ] =
      await this.prisma.$transaction([
        this.prisma.scan.count({
          where,
        }),

        this.prisma.scan.findMany({
          where,

          orderBy: {
            createdAt:
              'desc',
          },

          skip:
            (
              query.page -
              1
            ) *
            query.perPage,

          take:
            query.perPage,

          select: {
            id:
              true,

            type:
              true,

            trigger:
              true,

            status:
              true,

            branch:
              true,

            commitSha:
              true,

            progress:
              true,

            score:
              true,

            configuration:
              true,

            statistics:
              true,

            startedAt:
              true,

            completedAt:
              true,

            failedAt:
              true,

            createdAt:
              true,

            errorMessage:
              true,

            _count: {
              select: {
                findings:
                  true,
              },
            },
          },
        }),
      ]);

    return {
      items,

      pagination:
        this.createPagination(
          total,
          query.page,
          query.perPage,
        ),
    };
  }

  async getScan(
    organizationId: string,
    projectId: string,
    scanId: string,
  ) {
    const scan =
      await this.prisma.scan.findFirst({
        where: {
          id:
            scanId,

          projectId,

          repository: {
            organizationId,
          },
        },

        select: {
          id:
            true,

          projectId:
            true,

          repositoryId:
            true,

          type:
            true,

          trigger:
            true,

          status:
            true,

          branch:
            true,

          commitSha:
            true,

          progress:
            true,

          score:
            true,

          configuration:
            true,

          statistics:
            true,

          queueJobId:
            true,

          errorMessage:
            true,

          startedAt:
            true,

          completedAt:
            true,

          failedAt:
            true,

          createdAt:
            true,

          updatedAt:
            true,

          repository: {
            select: {
              id:
                true,

              provider:
                true,

              name:
                true,

              fullName:
                true,

              owner:
                true,

              defaultBranch:
                true,

              primaryLanguage:
                true,

              lastRemoteCommitSha:
                true,
            },
          },

          _count: {
            select: {
              findings:
                true,
            },
          },
        },
      });

    if (!scan) {
      throw new NotFoundException(
        'Scan introuvable.',
      );
    }

    return scan;
  }

  async getScanProgress(
    organizationId: string,
    projectId: string,
    scanId: string,
  ) {
    const scan =
      await this.prisma.scan.findFirst({
        where: {
          id:
            scanId,

          projectId,

          repository: {
            organizationId,
          },
        },

        select: {
          id:
            true,

          status:
            true,

          progress:
            true,

          score:
            true,

          errorMessage:
            true,

          startedAt:
            true,

          completedAt:
            true,

          failedAt:
            true,

          updatedAt:
            true,
        },
      });

    if (!scan) {
      throw new NotFoundException(
        'Scan introuvable.',
      );
    }

    return scan;
  }

  private async assertProject(
    organizationId: string,
    projectId: string,
  ): Promise<void> {
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
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable.',
      );
    }
  }

  private async assertRepository(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ): Promise<void> {
    const repository =
      await this.prisma.repository.findFirst({
        where: {
          id:
            repositoryId,

          organizationId,

          projectId,
        },

        select: {
          id:
            true,
        },
      });

    if (!repository) {
      throw new NotFoundException(
        'Repository introuvable.',
      );
    }
  }

  private createPagination(
    total: number,
    page: number,
    perPage: number,
  ) {
    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total /
            perPage,
        ),
      );

    return {
      page,
      perPage,
      total,
      totalPages,

      hasNextPage:
        page <
        totalPages,

      hasPreviousPage:
        page >
        1,
    };
  }

  async getRepositorySecurityOverview(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    await this.assertRepository(
      organizationId,
      projectId,
      repositoryId,
    );

    const [
      repository,
      latestScan,
      activeFindings,
      bySeverity,
      byStatus,
    ] =
      await Promise.all([
        this.prisma.repository.findFirst({
          where: {
            id:
              repositoryId,

            organizationId,

            projectId,
          },

          select: {
            id:
              true,

            provider:
              true,

            owner:
              true,

            name:
              true,

            fullName:
              true,

            defaultBranch:
              true,

            primaryLanguage:
              true,

            syncStatus:
              true,

            lastSyncedAt:
              true,

            lastRemoteCommitSha:
              true,
          },
        }),

        this.prisma.scan.findFirst({
          where: {
            repositoryId,
            projectId,
          },

          orderBy: {
            createdAt:
              'desc',
          },

          select: {
            id:
              true,

            status:
              true,

            type:
              true,

            trigger:
              true,

            score:
              true,

            progress:
              true,

            commitSha:
              true,

            statistics:
              true,

            startedAt:
              true,

            completedAt:
              true,

            createdAt:
              true,
          },
        }),

        this.prisma.finding.count({
          where: {
            repositoryId,

            status: {
              notIn: [
                'FIXED',
                'FALSE_POSITIVE',
                'CLOSED',
              ],
            },
          },
        }),

        this.prisma.finding.groupBy({
          by: [
            'severity',
          ],

          where: {
            repositoryId,

            status: {
              notIn: [
                'FIXED',
                'FALSE_POSITIVE',
                'CLOSED',
              ],
            },
          },

          _count: {
            _all:
              true,
          },
        }),

        this.prisma.finding.groupBy({
          by: [
            'status',
          ],

          where: {
            repositoryId,
          },

          _count: {
            _all:
              true,
          },
        }),
      ]);

    if (!repository) {
      throw new NotFoundException(
        'Repository introuvable.',
      );
    }

    return {
      repository,

      security: {
        activeFindings,

        score:
          latestScan?.score ??
          null,

        scoreReliable:
          this.extractBooleanStatistic(
            latestScan?.statistics,
            'securityScoreReliable',
          ),

        partial:
          this.extractBooleanStatistic(
            latestScan?.statistics,
            'partial',
          ),

        bySeverity:
          Object.fromEntries(
            bySeverity.map(
              (item) => [
                item.severity,
                item._count._all,
              ],
            ),
          ),

        byStatus:
          Object.fromEntries(
            byStatus.map(
              (item) => [
                item.status,
                item._count._all,
              ],
            ),
          ),
      },

      latestScan,
    };
  }

  private extractBooleanStatistic(
    value: unknown,
    key: string,
  ): boolean | null {
    if (
      !value ||
      typeof value !==
        'object' ||
      Array.isArray(value)
    ) {
      return null;
    }

    const candidate =
      (
        value as
          Record<
            string,
            unknown
          >
      )[key];

    return typeof candidate ===
      'boolean'
        ? candidate
        : null;
  }

  async getProjectSecurityDashboard(
    organizationId: string,
    projectId: string,
  ) {
    await this.assertProject(
      organizationId,
      projectId,
    );

    const [
      repositories,
      activeFindings,
      severity,
      latestScans,
      recentScans,
    ] =
      await Promise.all([
        this.prisma.repository.count({
          where: {
            organizationId,
            projectId,
            isArchived:
              false,
          },
        }),

        this.prisma.finding.count({
          where: {
            projectId,

            repository: {
              organizationId,
            },

            status: {
              notIn: [
                'FIXED',
                'FALSE_POSITIVE',
                'CLOSED',
              ],
            },
          },
        }),

        this.prisma.finding.groupBy({
          by: [
            'severity',
          ],

          where: {
            projectId,

            repository: {
              organizationId,
            },

            status: {
              notIn: [
                'FIXED',
                'FALSE_POSITIVE',
                'CLOSED',
              ],
            },
          },

          _count: {
            _all:
              true,
          },
        }),

        this.prisma.scan.findMany({
          where: {
            projectId,

            repository: {
              organizationId,
            },

            status:
              'COMPLETED',
          },

          orderBy: {
            completedAt:
              'desc',
          },

          distinct: [
            'repositoryId',
          ],

          select: {
            repositoryId:
              true,

            score:
              true,

            completedAt:
              true,

            statistics:
              true,
          },
        }),

        this.prisma.scan.findMany({
          where: {
            projectId,

            repository: {
              organizationId,
            },
          },

          orderBy: {
            createdAt:
              'desc',
          },

          take:
            10,

          select: {
            id:
              true,

            repositoryId:
              true,

            status:
              true,

            type:
              true,

            trigger:
              true,

            score:
              true,

            progress:
              true,

            createdAt:
              true,

            completedAt:
              true,

            repository: {
              select: {
                name:
                  true,

                fullName:
                  true,
              },
            },
          },
        }),
      ]);

    const validScores =
      latestScans
        .map(
          (scan) =>
            scan.score !==
            null
              ? Number(
                  scan.score,
                )
              : null,
        )
        .filter(
          (
            score,
          ): score is number =>
            score !== null &&
            Number.isFinite(
              score,
            ),
        );

    const averageScore =
      validScores.length >
        0
        ? Number(
            (
              validScores.reduce(
                (
                  total,
                  score,
                ) =>
                  total + score,
                0,
              ) /
              validScores.length
            ).toFixed(2),
          )
        : null;

    return {
      repositories,

      activeFindings,

      averageSecurityScore:
        averageScore,

      severity:
        Object.fromEntries(
          severity.map(
            (item) => [
              item.severity,
              item._count._all,
            ],
          ),
        ),

      repositoryScores:
        latestScans.map(
          (scan) => ({
            ...scan,

            score:
              scan.score !==
              null
                ? Number(
                    scan.score,
                  )
                : null,
          }),
        ),

      recentScans,
    };
  }

  async cancelScan(
    organizationId: string,
    projectId: string,
    scanId: string,
    userId: string,
  ) {
    const scan =
      await this.prisma.scan.findFirst({
        where: {
          id:
            scanId,

          projectId,

          repository: {
            organizationId,
          },
        },

        select: {
          id:
            true,

          status:
            true,

          queueJobId:
            true,

          repositoryId:
            true,

          configuration:
            true,
        },
      });

    if (!scan) {
      throw new NotFoundException(
        'Scan introuvable.',
      );
    }

    const existingConfiguration:
      Prisma.JsonObject =
      scan.configuration &&
      typeof scan.configuration ===
        'object' &&
      !Array.isArray(
        scan.configuration,
      )
        ? (
            scan.configuration as
              Prisma.JsonObject
          )
        : {};

    const cancellable =
      new Set<ScanStatus>([
        ScanStatus.QUEUED,
        ScanStatus.PREPARING,
        ScanStatus.DOWNLOADING,
        ScanStatus.DETECTING,
        ScanStatus.SCANNING,
        ScanStatus.PROCESSING_RESULTS,
        ScanStatus.CALCULATING_SCORE,
        ScanStatus.GENERATING_REPORT,
      ]);

    if (
      !cancellable.has(
        scan.status,
      )
    ) {
      throw new ConflictException(
        `Le scan ${scan.status} ne peut plus être annulé.`,
      );
    }

    if (
      scan.queueJobId
    ) {
      const job =
        await this.scanQueue.getJob(
          scan.queueJobId,
        );

      if (job) {
        try {
          await job.remove();
        } catch {
          /*
          * Un job actif ne peut pas toujours
          * être supprimé directement.
          *
          * Nous ajoutons donc aussi un marqueur
          * d'annulation en base.
          */
        }
      }
    }
    const now = new Date();

    const updated =
      await this.prisma.scan.update({
        where: {
          id:
            scan.id,
        },

        data: {
          status:
            ScanStatus.CANCELLED,

          completedAt:
            now,

          errorMessage:
            'Scan annulé par un utilisateur.',

          configuration: {
            ...existingConfiguration,

            cancellationRequested:
              true,

            cancellationRequestedAt:
              new Date()
                .toISOString(),

            cancellationRequestedBy:
              userId,
          },
        },
      });

    await this.prisma.auditLog.create({
      data: {
        organizationId,

        projectId,

        actorId:
          userId,

        action:
          AuditAction.SCAN,

        resourceType:
          'Scan',

        resourceId:
          scan.id,

        description:
          'Scan annulé par un utilisateur.',

        metadata: {
          repositoryId:
            scan.repositoryId,

          scanAction:
            'CANCEL',

          previousStatus:
            scan.status,

          newStatus:
            ScanStatus.CANCELLED,
        },
      },
    });

    return updated;
  }
}
