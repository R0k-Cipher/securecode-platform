import type {
  Prisma,
  Project,
} from '@prisma/client';

import type {
  ProjectLastScanResponse,
  ProjectResponse,
} from '../types/project-response.type';

type ProjectWithCounts = Project & {
  _count: {
    members: number;
    repositories: number;
    scans: number;
    findings: number;
    vulnerabilities: number;
    reports: number;
  };
};

type ProjectWithDetails =
  Prisma.ProjectGetPayload<{
    include: {
      createdBy: {
        select: {
          id: true;
          email: true;
          firstName: true;
          lastName: true;
          avatarUrl: true;
        };
      };
      scans: {
        take: 1;
        orderBy: {
          createdAt: 'desc';
        };
        select: {
          id: true;
          status: true;
          score: true;
          branch: true;
          commitSha: true;
          createdAt: true;
          completedAt: true;
        };
      };
      _count: {
        select: {
          members: true;
          repositories: true;
          scans: true;
          findings: true;
          vulnerabilities: true;
          reports: true;
        };
      };
    };
  }>;

export class ProjectMapper {
  static toResponse(project: Project): ProjectResponse {
    return {
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      slug: project.slug,
      description: project.description,
      status: project.status,
      defaultBranch: project.defaultBranch,
      createdById: project.createdById,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      archivedAt: project.archivedAt,
    };
  }

  static withCounts(
    project: ProjectWithCounts,
  ): ProjectResponse {
    return {
      ...this.toResponse(project),
      membersCount: project._count.members,
      repositoriesCount: project._count.repositories,
      scansCount: project._count.scans,
      findingsCount: project._count.findings,
      vulnerabilitiesCount:
        project._count.vulnerabilities,
      reportsCount: project._count.reports,
    };
  }

  static withDetails(
    project: ProjectWithDetails,
  ): ProjectResponse {
    const latestScan = project.scans[0];

    const lastScan: ProjectLastScanResponse | null =
      latestScan
        ? {
            id: latestScan.id,
            status: latestScan.status,
            score:
              latestScan.score === null
                ? null
                : Number(latestScan.score),
            branch: latestScan.branch,
            commitSha: latestScan.commitSha,
            createdAt: latestScan.createdAt,
            completedAt: latestScan.completedAt,
          }
        : null;

    return {
      ...this.withCounts(project),
      createdBy: project.createdBy,
      lastScan,
    };
  }
}
