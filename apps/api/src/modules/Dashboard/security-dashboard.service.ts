import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  FindingSeverity,
  FindingStatus,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

@Injectable()
export class SecurityDashboardService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getProjectDashboard(
    organizationId: string,
    projectId: string,
  ) {
    const project =
      await this.prisma.project.findFirst({
        where: {
          id: projectId,
          organizationId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          defaultBranch: true,
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable dans cette organisation.',
      );
    }

    const openStatuses: FindingStatus[] = [
      FindingStatus.DETECTED,
      FindingStatus.TO_REVIEW,
      FindingStatus.CONFIRMED,
      FindingStatus.ASSIGNED,
      FindingStatus.IN_PROGRESS,
      FindingStatus.READY_FOR_RETEST,
      FindingStatus.REOPENED,
    ];

    const [
      repositoriesCount,
      scansCount,
      findingsCount,
      openFindingsCount,
      severityGroups,
      latestScan,
      repositories,
      recentScans,
    ] = await this.prisma.$transaction([
      this.prisma.repository.count({
        where: {
          organizationId,
          projectId,
          isArchived: false,
        },
      }),

      this.prisma.scan.count({
        where: {
          organizationId,
          projectId,
        },
      }),

      this.prisma.finding.count({
        where: {
          projectId,
        },
      }),

      this.prisma.finding.count({
        where: {
          projectId,
          status: {
            in: openStatuses,
          },
        },
      }),

      this.prisma.finding.groupBy({
        by: ['severity'],
        where: {
          projectId,
          status: {
            in: openStatuses,
          },
        },
        _count: {
          _all: true,
        },
      }),

      this.prisma.scan.findFirst({
        where: {
          organizationId,
          projectId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          type: true,
          status: true,
          score: true,
          progress: true,
          trigger: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
            },
          },
        },
      }),

      this.prisma.repository.findMany({
        where: {
          organizationId,
          projectId,
          isArchived: false,
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 10,
        select: {
          id: true,
          provider: true,
          name: true,
          fullName: true,
          primaryLanguage: true,
          syncStatus: true,
          lastSyncedAt: true,
        },
      }),

      this.prisma.scan.findMany({
        where: {
          organizationId,
          projectId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
        select: {
          id: true,
          type: true,
          trigger: true,
          status: true,
          score: true,
          progress: true,
          createdAt: true,
          startedAt: true,
          completedAt: true,
          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
            },
          },
          _count: {
            select: {
              findings: true,
            },
          },
        },
      }),
    ]);

    const severity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    for (const item of severityGroups) {
      switch (item.severity) {
        case FindingSeverity.CRITICAL:
          severity.critical = item._count._all;
          break;

        case FindingSeverity.HIGH:
          severity.high = item._count._all;
          break;

        case FindingSeverity.MEDIUM:
          severity.medium = item._count._all;
          break;

        case FindingSeverity.LOW:
          severity.low = item._count._all;
          break;

        case FindingSeverity.INFO:
          severity.info = item._count._all;
          break;
      }
    }

    return {
      project,

      summary: {
        repositories: repositoriesCount,
        scans: scansCount,
        findings: findingsCount,
        openFindings: openFindingsCount,
        securityScore:
          latestScan?.score !== null &&
          latestScan?.score !== undefined
            ? Number(latestScan.score)
            : null,

        severity,
      },

      latestScan: latestScan
        ? {
            ...latestScan,
            score:
              latestScan.score !== null
                ? Number(latestScan.score)
                : null,
          }
        : null,

      repositories,

      recentScans:
        recentScans.map((scan) => ({
          ...scan,
          score:
            scan.score !== null
              ? Number(scan.score)
              : null,
        })),
    };
  }
}
