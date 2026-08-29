import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

import {
  Prisma,
  AuditAction,
  FindingStatus,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  ListFindingsDto,
} from './dto/list-findings.dto';

import {
  UpdateFindingStatusDto,
} from './dto/update-finding-status.dto';

@Injectable()
export class FindingsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async list(
    organizationId:
      string,

    projectId:
      string,

    query:
      ListFindingsDto,

    repositoryId?:
      string,

    scanId?:
      string,
  ) {
    const where:
      Prisma.FindingWhereInput = {
      projectId,

      repository: {
        organizationId,
      },

      ...(repositoryId
        ? {
            repositoryId,
          }
        : {}),

      ...(scanId
        ? {
            scanId,
          }
        : {}),

      ...(query.severity
        ? {
            severity:
              query.severity,
          }
        : {}),

      ...(query.status
        ? {
            status:
              query.status,
          }
        : {}),

      ...(query.scanner
        ? {
            scanner:
              query.scanner,
          }
        : {}),

      ...(query.category
        ? {
            category:
              query.category,
          }
        : {}),

      ...(query.cweId
        ? {
            cweId:
              query.cweId,
          }
        : {}),

      ...(query.owaspCategory
        ? {
            owaspCategory:
              query.owaspCategory,
          }
        : {}),

      ...(query.filePath
        ? {
            filePath: {
              contains:
                query.filePath,

              mode:
                'insensitive',
            },
          }
        : {}),

      ...(query.search
        ? {
            OR: [
              {
                title: {
                  contains:
                    query.search,

                  mode:
                    'insensitive',
                },
              },

              {
                description: {
                  contains:
                    query.search,

                  mode:
                    'insensitive',
                },
              },

              {
                filePath: {
                  contains:
                    query.search,

                  mode:
                    'insensitive',
                },
              },

              {
                ruleId: {
                  contains:
                    query.search,

                  mode:
                    'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [
      total,
      items,
    ] =
      await this.prisma
        .$transaction([
          this.prisma
            .finding
            .count({
              where,
            }),

          this.prisma
            .finding
            .findMany({
              where,

              orderBy: [
                {
                  severity:
                    'desc',
                },

                {
                  lastDetectedAt:
                    'desc',
                },
              ],

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

                repositoryId:
                  true,

                scanId:
                  true,

                ruleId:
                  true,

                scanner:
                  true,

                fingerprint:
                  true,

                title:
                  true,

                severity:
                  true,

                status:
                  true,

                category:
                  true,

                cweId:
                  true,

                owaspCategory:
                  true,

                filePath:
                  true,

                startLine:
                  true,

                startColumn:
                  true,

                confidence:
                  true,

                firstDetectedAt:
                  true,

                lastDetectedAt:
                  true,

                resolvedAt:
                  true,

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
            }),
        ]);

    return {
      items,

      pagination:
        this.pagination(
          total,
          query.page,
          query.perPage,
        ),
    };
  }

  async getOne(
    organizationId:
      string,

    projectId:
      string,

    findingId:
      string,
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

        select: {
          id:
            true,

          ruleId:
            true,

          scanner:
            true,

          fingerprint:
            true,

          title:
            true,

          description:
            true,

          severity:
            true,

          status:
            true,

          category:
            true,

          cweId:
            true,

          owaspCategory:
            true,

          filePath:
            true,

          startLine:
            true,

          startColumn:
            true,

          endLine:
            true,

          endColumn:
            true,

          codeSnippet:
            true,

          recommendation:
            true,

          confidence:
            true,

          metadata:
            true,

          firstDetectedAt:
            true,

          lastDetectedAt:
            true,

          resolvedAt:
            true,

          createdAt:
            true,

          updatedAt:
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

          scan: {
            select: {
              id:
                true,

              type:
                true,

              status:
                true,

              commitSha:
                true,

              branch:
                true,

              createdAt:
                true,
            },
          },

          occurrences: {
            orderBy: {
              detectedAt: 'desc',
            },
            take:
              50,
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

  async getOverview(
    organizationId: string,
    projectId: string,
    repositoryId?: string,
  ) {
    const baseWhere:
      Prisma.FindingWhereInput = {
      projectId,

      repository: {
        organizationId,
      },

      ...(repositoryId
        ? {
            repositoryId,
          }
        : {}),

      status: {
        notIn: [
          FindingStatus.FIXED,
          FindingStatus.FALSE_POSITIVE,
          FindingStatus.CLOSED,
        ],
      },
    };

    const [
      total,
      severity,
      status,
    ] =
      await Promise.all([
        this.prisma.finding.count({
          where:
            baseWhere,
        }),

        this.prisma.finding.groupBy({
          by: [
            'severity',
          ],

          where:
            baseWhere,

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
            projectId,

            repository: {
              organizationId,
            },

            ...(repositoryId
              ? {
                  repositoryId,
                }
              : {}),
          },

          _count: {
            _all:
              true,
          },
        }),
      ]);

    return {
      totalActive:
        total,

      bySeverity:
        Object.fromEntries(
          severity.map(
            (item) => [
              item.severity,
              item._count._all,
            ],
          ),
        ),

      byStatus:
        Object.fromEntries(
          status.map(
            (item) => [
              item.status,
              item._count._all,
            ],
          ),
        ),
    };
  }

  private pagination(
    total: number,
    page: number,
    perPage: number,
  ) {
    const totalPages =
      Math.max(
        1,
        Math.ceil(
          total / perPage,
        ),
      );

    return {
      page,
      perPage,
      total,
      totalPages,

      hasNextPage:
        page < totalPages,

      hasPreviousPage:
        page > 1,
    };
  }

  private isResolvedStatus(
    status: FindingStatus,
  ): boolean {
    const resolvedStatuses =
      new Set<FindingStatus>([
        FindingStatus.FIXED,
        FindingStatus.FALSE_POSITIVE,
        FindingStatus.ACCEPTED_RISK,
        FindingStatus.CLOSED,
      ]);

    return resolvedStatuses.has(
      status,
    );
  }

  async updateStatus(
    organizationId: string,
    projectId: string,
    findingId: string,
    userId: string,
    dto: UpdateFindingStatusDto,
  ) {
    const finding =
      await this.prisma.finding.findFirst({
        where: {
          id: findingId,
          projectId,

          repository: {
            organizationId,
          },
        },

        select: {
          id: true,
          status: true,
          repositoryId: true,
          scanId: true,
        },
      });

    if (!finding) {
      throw new NotFoundException(
        'Finding introuvable.',
      );
    }

    this.assertValidStatusTransition(
      finding.status,
      dto.status,
    );

    const now =
      new Date();

    const updated =
      await this.prisma.finding.update({
        where: {
          id: finding.id,
        },

        data: {
          status:
            dto.status,

          resolvedAt:
            this.isResolvedStatus(
              dto.status,
            )
              ? now
              : null,

          metadata: {
            statusChangedBy:
              userId,

            statusChangedAt:
              now.toISOString(),

            statusComment:
              dto.comment ??
              null,
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
          AuditAction.CHANGE_STATUS,

        resourceType:
          'Finding',

        resourceId:
          finding.id,

        description:
          `Changement du statut du finding ${finding.id}`,

        metadata: {
          repositoryId:
            finding.repositoryId,

          scanId:
            finding.scanId,

          previousStatus:
            finding.status,

          newStatus:
            dto.status,

          comment:
            dto.comment ??
            null,
        },
      },
    });

    return updated;
  }

  private assertValidStatusTransition(
    current: FindingStatus,
    next: FindingStatus,
  ): void {
    if (
      current === next
    ) {
      return;
    }

    const allowed:
      Record<
        FindingStatus,
        FindingStatus[]
      > = {
      [FindingStatus.DETECTED]: [
        FindingStatus.TO_REVIEW,
        FindingStatus.CONFIRMED,
        FindingStatus.FALSE_POSITIVE,
        FindingStatus.ACCEPTED_RISK,
        FindingStatus.CLOSED,
      ],

      [FindingStatus.TO_REVIEW]: [
        FindingStatus.DETECTED,
        FindingStatus.CONFIRMED,
        FindingStatus.FALSE_POSITIVE,
        FindingStatus.ACCEPTED_RISK,
        FindingStatus.CLOSED,
      ],

      [FindingStatus.CONFIRMED]: [
        FindingStatus.ASSIGNED,
        FindingStatus.IN_PROGRESS,
        FindingStatus.ACCEPTED_RISK,
        FindingStatus.FALSE_POSITIVE,
        FindingStatus.CLOSED,
      ],

      [FindingStatus.ASSIGNED]: [
        FindingStatus.IN_PROGRESS,
        FindingStatus.TO_REVIEW,
        FindingStatus.CLOSED,
      ],

      [FindingStatus.IN_PROGRESS]: [
        FindingStatus.READY_FOR_RETEST,
        FindingStatus.ACCEPTED_RISK,
        FindingStatus.CLOSED,
      ],

      [FindingStatus.READY_FOR_RETEST]: [
        FindingStatus.FIXED,
        FindingStatus.REOPENED,
        FindingStatus.IN_PROGRESS,
      ],

      [FindingStatus.FALSE_POSITIVE]: [
        FindingStatus.TO_REVIEW,
        FindingStatus.CONFIRMED,
        FindingStatus.CLOSED,
      ],

      [FindingStatus.ACCEPTED_RISK]: [
        FindingStatus.TO_REVIEW,
        FindingStatus.CONFIRMED,
        FindingStatus.CLOSED,
      ],

      [FindingStatus.FIXED]: [
        FindingStatus.REOPENED,
        FindingStatus.CLOSED,
      ],

      [FindingStatus.REOPENED]: [
        FindingStatus.ASSIGNED,
        FindingStatus.IN_PROGRESS,
        FindingStatus.TO_REVIEW,
        FindingStatus.CLOSED,
      ],

      [FindingStatus.CLOSED]: [
        FindingStatus.REOPENED,
      ],
    };

    if (
      !allowed[current].includes(
        next,
      )
    ) {
      throw new BadRequestException(
        `Transition de statut interdite : ${current} → ${next}`,
      );
    }
  }


}
