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
  FindingStatus,
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
  organizationId: string,
  projectId: string,
  repositoryId: string,
  userId: string,
) {
  return this.createRepositoryScan({
    organizationId,
    projectId,
    repositoryId,

    requestedById:
      userId,

    type:
      ScanType.MANUAL_SCAN,

    trigger:
      ScanTrigger.MANUAL,

    queueTrigger:
      'MANUAL',

    requestedMode:
      'AUTO',

    correlationId:
      randomUUID(),
  });
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

  async createScheduledScan(
  organizationId: string,
  projectId: string,
  repositoryId: string,
  correlationId = randomUUID(),
) {
  return this.createRepositoryScan({
    organizationId,
    projectId,
    repositoryId,

    requestedById:
      null,

    type:
      ScanType.FULL_SCAN,

    trigger:
      ScanTrigger.SCHEDULED,

    queueTrigger:
      'SCHEDULED',

    requestedMode:
      'AUTO',

    correlationId,
  });
}

private async createRepositoryScan(
  input: {
    organizationId: string;
    projectId: string;
    repositoryId: string;

    requestedById:
      string | null;

    type:
      ScanType;

    trigger:
      ScanTrigger;

    queueTrigger:
      SecurityScanJobData['trigger'];

    requestedMode:
      SecurityScanJobData['requestedMode'];

    correlationId:
      string;
  },
) {
  const repository =
    await this.prisma.repository.findFirst({
      where: {
        id:
          input.repositoryId,

        organizationId:
          input.organizationId,

        projectId:
          input.projectId,

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

        gitConnection: {
          select: {
            id:
              true,

            status:
              true,
          },
        },
      },
    });

  if (!repository) {
    throw new NotFoundException(
      'Repository introuvable.',
    );
  }

  if (
    repository.gitConnection.status !==
    'ACTIVE'
  ) {
    throw new ConflictException(
      'La connexion Git du repository n’est pas active.',
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

  /*
   * Évite plusieurs analyses identiques en parallèle
   * sur le même commit.
   */
  const existingScan =
    await this.prisma.scan.findFirst({
      where: {
        projectId:
          input.projectId,

        repositoryId:
          input.repositoryId,

        commitSha:
          repository.lastRemoteCommitSha,

        status: {
          in: [
            ScanStatus.QUEUED,
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

      select: {
        id:
          true,

        status:
          true,

        queueJobId:
          true,
      },
    });

  if (existingScan) {
    return {
      scanId:
        existingScan.id,

      repositoryId:
        input.repositoryId,

      status:
        existingScan.status,

      correlationId:
        input.correlationId,

      duplicate:
        true,
    };
  }

  /*
   * Chercher le dernier scan COMPLETED afin
   * que AUTO puisse calculer un vrai delta.
   */

  const previousCompletedScan =
    await this.prisma.scan.findFirst({
      where: {
        projectId:
          input.projectId,

        repositoryId:
          input.repositoryId,

        status:
          ScanStatus.COMPLETED,
      },

      orderBy: {
        completedAt:
          'desc',
      },

      select: {
        commitSha:
          true,
      },
    });


  const fromSha =
    previousCompletedScan
      ?.commitSha ??
    null;

  const scan =
    await this.prisma.scan.create({
      data: {
        projectId:
          input.projectId,

        repositoryId:
          input.repositoryId,

        requestedById:
          input.requestedById,

        type:
          input.type,

        trigger:
          input.trigger,

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
            input.requestedMode,

          correlationId:
            input.correlationId,

          fromSha,

          toSha:
            repository.lastRemoteCommitSha,

          scheduled:
            input.queueTrigger ===
            'SCHEDULED',
        },
      },
    });

  const jobData:
    SecurityScanJobData = {
    organizationId:
      input.organizationId,

    projectId:
      input.projectId,

    repositoryId:
      input.repositoryId,

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

    fromSha,

    toSha:
      repository.lastRemoteCommitSha,

    pullRequestId:
      null,

    requestedMode:
      input.requestedMode,

    trigger:
      input.queueTrigger,

    triggeredById:
      input.requestedById,

    eventId:
      null,

    requestedAt:
      new Date()
        .toISOString(),

    correlationId:
      input.correlationId,
  };

  try {
    const job =
      await this.scanQueue.add(
        JOB_NAMES.SECURITY_SCAN,
        jobData,
        {
          jobId:
            `security-scan-${scan.id}`,

          attempts:
            3,

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

    await this.prisma.scan.update({
      where: {
        id:
          scan.id,
      },

      data: {
        queueJobId:
          job.id
            ? String(job.id)
            : null,
      },
    });

    return {
      scanId:
        scan.id,

      repositoryId:
        input.repositoryId,

      status:
        ScanStatus.QUEUED,

      correlationId:
        input.correlationId,

      duplicate:
        false,
    };
  } catch (error) {
    await this.prisma.scan.update({
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

        name:
          true,

        description:
          true,
      },
    });

  if (!project) {
    throw new NotFoundException(
      'Projet introuvable.',
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Finding statuses considered active
  |--------------------------------------------------------------------------
  */

  const closedFindingStatuses:
    FindingStatus[] = [
      FindingStatus.FIXED,
      FindingStatus.FALSE_POSITIVE,
      FindingStatus.CLOSED,
    ];

  const activeFindingWhere:
    Prisma.FindingWhereInput = {
    projectId,

    repository: {
      organizationId,
    },

    status: {
      notIn:
        closedFindingStatuses,
    },
  };

  /*
  |--------------------------------------------------------------------------
  | Main dashboard data
  |--------------------------------------------------------------------------
  */

  const [
    repositories,
    scans,
    failedScans,
    findings,
    openFindings,

    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    infoCount,

    completedScans,
    recentScans,
    criticalFindings,
  ] =
    await Promise.all([
      /*
       * Repositories
       */
      this.prisma.repository.count({
        where: {
          organizationId,

          projectId,

          isArchived:
            false,
        },
      }),

      /*
       * Total scans
       */
      this.prisma.scan.count({
        where: {
          projectId,

          repository: {
            organizationId,
          },
        },
      }),

      /*
       * Failed scans
       */
      this.prisma.scan.count({
        where: {
          projectId,

          status:
            ScanStatus.FAILED,

          repository: {
            organizationId,
          },
        },
      }),

      /*
       * Total findings
       */
      this.prisma.finding.count({
        where: {
          projectId,

          repository: {
            organizationId,
          },
        },
      }),

      /*
       * Active findings
       */
      this.prisma.finding.count({
        where:
          activeFindingWhere,
      }),

      /*
       * Critical
       */
      this.prisma.finding.count({
        where: {
          ...activeFindingWhere,

          severity:
            'CRITICAL',
        },
      }),

      /*
       * High
       */
      this.prisma.finding.count({
        where: {
          ...activeFindingWhere,

          severity:
            'HIGH',
        },
      }),

      /*
       * Medium
       */
      this.prisma.finding.count({
        where: {
          ...activeFindingWhere,

          severity:
            'MEDIUM',
        },
      }),

      /*
       * Low
       */
      this.prisma.finding.count({
        where: {
          ...activeFindingWhere,

          severity:
            'LOW',
        },
      }),

      /*
       * Info
       */
      this.prisma.finding.count({
        where: {
          ...activeFindingWhere,

          severity:
            'INFO',
        },
      }),

      /*
       * Completed scans used for:
       * - project score
       * - history
       * - performance
       */
      this.prisma.scan.findMany({
        where: {
          projectId,

          status:
            ScanStatus.COMPLETED,

          repository: {
            organizationId,
          },
        },

        orderBy: {
          completedAt:
            'desc',
        },

        take:
          50,

        select: {
          id:
            true,

          repositoryId:
            true,

          score:
            true,

          statistics:
            true,

          createdAt:
            true,

          completedAt:
            true,
        },
      }),

      /*
       * Recent scans
       */
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
              id:
                true,

              name:
                true,

              fullName:
                true,

              provider:
                true,
            },
          },
        },
      }),

      /*
       * Critical / High priority findings
       */
      this.prisma.finding.findMany({
        where: {
          ...activeFindingWhere,

          severity: {
            in: [
              'CRITICAL',
              'HIGH',
            ],
          },
        },

        orderBy: [
          {
            severity:
              'asc',
          },

          {
            createdAt:
              'desc',
          },
        ],

        take:
          10,

        select: {
          id:
            true,

          title:
            true,

          severity:
            true,

          status:
            true,

          filePath:
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
            },
          },

          assignments: {
            take:
              1,

            /*
             * Pas d'orderBy createdAt :
             * ton FindingAssignment ne possède
             * pas ce champ dans ton schéma actuel.
             */

            select: {
              id:
                true,

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
            },
          },
        },
      }),
    ]);

  /*
  |--------------------------------------------------------------------------
  | Severity
  |--------------------------------------------------------------------------
  */

  const severity = {
    INFO:
      infoCount,

    LOW:
      lowCount,

    MEDIUM:
      mediumCount,

    HIGH:
      highCount,

    CRITICAL:
      criticalCount,
  };

  /*
  |--------------------------------------------------------------------------
  | Latest completed scan per repository
  |--------------------------------------------------------------------------
  */

  const latestScanByRepository =
    new Map<
      string,
      (typeof completedScans)[number]
    >();

  for (
    const scan of
    completedScans
  ) {
    if (
      latestScanByRepository.has(
        scan.repositoryId,
      )
    ) {
      continue;
    }

    latestScanByRepository.set(
      scan.repositoryId,
      scan,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Project security score
  |--------------------------------------------------------------------------
  */

  const repositoryScores =
    Array.from(
      latestScanByRepository.values(),
    )
      .map(
        scan =>
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

  const securityScore =
    repositoryScores.length
      ? Number(
          (
            repositoryScores.reduce(
              (
                total,
                score,
              ) =>
                total +
                score,
              0,
            ) /
            repositoryScores.length
          ).toFixed(
            2,
          ),
        )
      : null;

  /*
  |--------------------------------------------------------------------------
  | Grade
  |--------------------------------------------------------------------------
  */

  const grade =
    securityScore ===
    null
      ? null
      : securityScore >=
          90
        ? 'A'
        : securityScore >=
            80
          ? 'B'
          : securityScore >=
              70
            ? 'C'
            : securityScore >=
                60
              ? 'D'
              : 'F';

  /*
  |--------------------------------------------------------------------------
  | Score history
  |--------------------------------------------------------------------------
  */

  const scoreHistory =
    completedScans
      .filter(
        scan =>
          scan.score !==
          null,
      )
      .slice(
        0,
        12,
      )
      .reverse()
      .map(
        scan => ({
          id:
            scan.id,

          scanId:
            scan.id,

          score:
            scan.score !==
            null
              ? Number(
                  scan.score,
                )
              : null,

          status:
            ScanStatus.COMPLETED,

          createdAt:
            (
              scan.completedAt ??
              scan.createdAt
            ).toISOString(),
        }),
      );

  /*
  |--------------------------------------------------------------------------
  | Scan performance
  |--------------------------------------------------------------------------
  */

  const completedScansCount =
    completedScans.length;

  const scoredScans =
    completedScans.filter(
      scan =>
        scan.score !==
        null,
    );

  const averageScore =
    scoredScans.length
      ? Number(
          (
            scoredScans.reduce(
              (
                total,
                scan,
              ) =>
                total +
                Number(
                  scan.score,
                ),
              0,
            ) /
            scoredScans.length
          ).toFixed(
            2,
          ),
        )
      : null;

  const terminalScansCount =
    completedScansCount +
    failedScans;

  const successRate =
    terminalScansCount >
    0
      ? Number(
          (
            (
              completedScansCount /
              terminalScansCount
            ) *
            100
          ).toFixed(
            1,
          ),
        )
      : 0;

  let trend:
    'UP' |
    'DOWN' |
    'STABLE' =
    'STABLE';

  let scoreDelta:
    number |
    null =
    null;

  if (
    scoredScans.length >=
    2
  ) {
    const current =
      Number(
        scoredScans[0]
          .score,
      );

    const previous =
      Number(
        scoredScans[1]
          .score,
      );

    scoreDelta =
      Number(
        (
          current -
          previous
        ).toFixed(
          2,
        ),
      );

    if (
      scoreDelta >
      0
    ) {
      trend =
        'UP';
    } else if (
      scoreDelta <
      0
    ) {
      trend =
        'DOWN';
    }
  }

  /*
  |--------------------------------------------------------------------------
  | OWASP
  |--------------------------------------------------------------------------
  |
  | On ne crée aucune fausse donnée.
  | On branchera la vraie catégorie OWASP lorsque
  | le champ exact du Finding sera confirmé.
  |--------------------------------------------------------------------------
  */

  const owasp:
    Array<{
      category: string;
      count: number;
    }> =
    [];

  /*
  |--------------------------------------------------------------------------
  | WSTG
  |--------------------------------------------------------------------------
  |
  | Pas de valeur fictive.
  | Les vrais ProjectWstgControl seront branchés ensuite.
  |--------------------------------------------------------------------------
  */

  const wstg = {
    score:
      0,

    grade:
      '—',

    categories:
      [],

    totalCategories:
      0,
  };

  /*
  |--------------------------------------------------------------------------
  | Final API contract
  |--------------------------------------------------------------------------
  */

  return {
    project,

    summary: {
      repositories,

      scans,

      failedScans,

      findings,

      openFindings,

      securityScore,

      grade,
    },

    severity,

    owasp,

    scoreHistory,

    criticalFindings,

    recentScans:
      recentScans.map(
        scan => ({
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

    wstg,

    scanPerformance: {
      averageScore,

      successRate,

      trend,

      scoreDelta,

      completedScans:
        completedScansCount,
    },
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
