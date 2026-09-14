import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditAction,
  FindingSeverity,
  FindingStatus,
  Prisma,
  ReportFormat,
  ReportStatus,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  createHash,
} from 'crypto';

import PDFDocument from 'pdfkit';

import {
  CreateReportDto,
  ReportScope,
} from './dto/create-report.dto';

import {
  NotificationsService,
} from '../notifications/notifications.service';



type JsonObject =
  Record<string, unknown>;

interface ReportFilters {
  scope?: ReportScope | string;
  repositoryId?: string;
  fromDate?: string;
  toDate?: string;
}

interface ReportSource {
  report: {
    id: string;
    name: string;
    format: ReportFormat;
    scope: ReportScope;
    generatedAt: string;
  };

  wstg?: {
      score: number;
      grade: string;
      categories: Array<{
        code: string;
        name: string;
        findings: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
        score: number;
        grade: string;
      }>;
      totalCategories: number;
    };

  organization: {
    id: string;
    name: string;
  };

  project: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    defaultBranch: string | null;
  };

  period: {
    from: string | null;
    to: string | null;
  };

  summary: {
    repositories: number;
    scans: number;
    completedScans: number;
    failedScans: number;
    findings: number;
    activeFindings: number;
    resolvedFindings: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    averageScore: number | null;
    latestScore: number | null;
    remediationRate: number;
    riskLevel: string;
  };

  severity: Record<string, number>;

  status: Record<string, number>;

  categories: Array<{
    name: string;
    count: number;
  }>;

  owasp: Array<{
    name: string;
    count: number;
  }>;

  cwe: Array<{
    name: string;
    count: number;
  }>;

  repositories: Array<{
    id: string;
    name: string;
    fullName: string;
    provider: string;
    primaryLanguage: string | null;
    defaultBranch: string | null;
    scans: number;
    findings: number;
    activeFindings: number;
    critical: number;
    high: number;
    latestScore: number | null;
  }>;

  scans: Array<{
    id: string;
    repository: string;
    repositoryId: string;
    type: string;
    trigger: string;
    status: string;
    branch: string;
    commitSha: string;
    score: number | null;
    requestedBy: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;

  findings: Array<{
    id: string;
    repository: string;
    scanId: string;
    title: string;
    severity: string;
    status: string;
    category: string | null;
    owaspCategory: string | null;
    cweId: string | null;
    cvssScore: number | null;
    scanner: string;
    ruleId: string;
    filePath: string | null;
    startLine: number | null;
    endLine: number | null;
    confidence: number | null;
    recommendation: string | null;
    firstDetectedAt: string;
    lastDetectedAt: string;
    resolvedAt: string | null;
  }>;

  remediation: Array<{
    findingId: string;
    findingTitle: string;
    repository: string;
    actor: string;
    action: string;
    previousStatus: string | null;
    newStatus: string | null;
    comment: string | null;
    date: string;
  }>;

  auditTrail: Array<{
    id: string;
    actor: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    description: string | null;
    date: string;
  }>;

  recommendations: string[];

  conclusion: string;
}

interface OrganizationReportProjectSummary {
  id: string;
  name: string;
  slug: string;
  status: string;

  repositories: number;

  scans: number;
  completedScans: number;
  failedScans: number;

  findings: number;
  activeFindings: number;
  resolvedFindings: number;

  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;

  averageScore: number | null;

  remediationRate: number;

  riskLevel: string;
}

interface OrganizationReportSource {
  report: {
    id: string;
    name: string;
    format: ReportFormat;
    scope: ReportScope.ORGANIZATION;
    generatedAt: string;
  };

  organization: {
    id: string;
    name: string;
    slug: string;
  };

  period: {
    from: string;
    to: string;
  };

  summary: {
    projects: number;
    repositories: number;

    scans: number;
    completedScans: number;
    failedScans: number;

    findings: number;
    activeFindings: number;
    resolvedFindings: number;

    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;

    averageScore: number | null;

    remediationRate: number;

    riskLevel: string;
  };

  projects:
    OrganizationReportProjectSummary[];
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // ==========================================================================
  // ACCESS
  // ==========================================================================
  private readonly remediationStatuses =
    new Set<FindingStatus>([
      FindingStatus.IN_PROGRESS,
      FindingStatus.READY_FOR_RETEST,
      FindingStatus.FIXED,
      FindingStatus.REOPENED,
      FindingStatus.ACCEPTED_RISK,
      FindingStatus.CLOSED,
      FindingStatus.FALSE_POSITIVE,
    ]);

  private readonly resolvedStatuses =
    new Set<FindingStatus>([
      FindingStatus.FIXED,
      FindingStatus.FALSE_POSITIVE,
      FindingStatus.ACCEPTED_RISK,
      FindingStatus.CLOSED,
    ]);

  private readonly OWASP_TO_WSTG: Record<string, string> = {
    A01: 'WSTG-ATHZ',
    A02: 'WSTG-CRYP',
    A03: 'WSTG-INPV',
    A04: 'WSTG-BUSL',
    A05: 'WSTG-CONF',
    A06: 'WSTG-ATHN',
    A07: 'WSTG-ATHN',
    A08: 'WSTG-CONF',
    A09: 'WSTG-ERRH',
    A10: 'WSTG-INPV',

    'A01:2021': 'WSTG-ATHZ',
    'A02:2021': 'WSTG-CRYP',
    'A03:2021': 'WSTG-INPV',
    'A04:2021': 'WSTG-BUSL',
    'A05:2021': 'WSTG-CONF',
    'A06:2021': 'WSTG-ATHN',
    'A07:2021': 'WSTG-ATHN',
    'A08:2021': 'WSTG-CONF',
    'A09:2021': 'WSTG-ERRH',
    'A10:2021': 'WSTG-INPV',
  };


  private async ensureAccess(
    organizationId: string,
    projectId: string,
    userId: string,
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

          name:
            true,

          slug:
            true,

          description:
            true,

          status:
            true,

          defaultBranch:
            true,

          organization: {
            select: {
              id:
                true,

              name:
                true,
            },
          },
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable.',
      );
    }

    const organizationMembership =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },

        include: {
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

    if (!organizationMembership) {
      throw new NotFoundException(
        'Accès au projet refusé.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | OWNER
    |--------------------------------------------------------------------------
    */

    if (
      organizationMembership.role.code ===
      'OWNER'
    ) {
      return project;
    }

    /*
    |--------------------------------------------------------------------------
    | Tous les autres doivent être ProjectMember
    |--------------------------------------------------------------------------
    */

    const projectMembership =
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
              code:
                true,

              scope:
                true,
            },
          },
        },
      });

    if (
      !projectMembership ||
      projectMembership.role.scope !==
        'PROJECT'
    ) {
      throw new NotFoundException(
        'Accès au projet refusé.',
      );
    }

    return project;
  }

  // ==========================================================================
  // LIST
  // ==========================================================================

  async list(
    organizationId: string,
    projectId: string,
    userId: string,
    repositoryId?: string,
  ) {
    await this.ensureAccess(
      organizationId,
      projectId,
      userId,
    );

    const reports =
      await this.prisma.report.findMany({
        where: {
          projectId,

          ...(repositoryId
            ? {
                filters: {
                  path: ['repositoryId'],
                  equals: repositoryId,
                },
              }
            : {}),
        },

        orderBy: {
          createdAt: 'desc',
        },

        include: {
          requestedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },

          scan: {
            select: {
              id: true,
              repositoryId: true,
              status: true,
              score: true,
              createdAt: true,
            },
          },
        },
      });

    return reports.map(
      (report) => {
        const filters =
          this.parseFilters(
            report.filters,
          );

        return {
          id: report.id,
          projectId: report.projectId,
          scanId: report.scanId,
          status: report.status,
          format: report.format,
          name: report.name,
          scope:
            filters.scope ??
            (report.scanId
              ? ReportScope.SCAN
              : ReportScope.REPOSITORY),
          repositoryId:
            filters.repositoryId ??
            null,
          fromDate:
            filters.fromDate ??
            null,
          toDate:
            filters.toDate ??
            null,
          fileSize:
            report.fileSize
              ? Number(report.fileSize)
              : null,
          checksum:
            report.checksum,
          generatedAt:
            report.generatedAt,
          expiresAt:
            report.expiresAt,
          createdAt:
            report.createdAt,
          requestedBy:
            report.requestedBy,
          scan:
            report.scan
              ? {
                  ...report.scan,
                  score:
                    report.scan.score
                      ? Number(
                          report.scan.score,
                        )
                      : null,
                }
              : null,
        };
      },
    );
  }

  // ==========================================================================
  // CREATE
  // ==========================================================================

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    dto: CreateReportDto,
  ) {
    const project =
      await this.ensureAccess(
        organizationId,
        projectId,
        userId,
      );

    if (
      dto.scope ===
      ReportScope.ORGANIZATION
    ) {
      throw new BadRequestException(
        'Un rapport ORGANIZATION doit être créé depuis /organizations/:organizationId/reports.',
      );
    }

    if (
      dto.scope ===
      ReportScope.SCAN
    ) {
      if (!dto.scanId) {
        throw new BadRequestException(
          'scanId est obligatoire pour un rapport SCAN.',
        );
      }

      const scan =
        await this.prisma.scan.findFirst({
          where: {
            id: dto.scanId,
            projectId,

            repository: {
              organizationId,
            },
          },
          select: {
            id: true,
            repositoryId: true,
            status: true,
          },
        });

      if (!scan) {
        throw new NotFoundException(
          'Scan introuvable.',
        );
      }

      if (
        scan.status !==
        'COMPLETED'
      ) {
        throw new BadRequestException(
          'Le rapport ne peut être généré que pour un scan terminé.',
        );
      }
    }

    if (
      dto.scope ===
      ReportScope.REPOSITORY
    ) {
      if (!dto.repositoryId) {
        throw new BadRequestException(
          'repositoryId est obligatoire pour un rapport REPOSITORY.',
        );
      }

      const repository =
        await this.prisma.repository.findFirst({
          where: {
            id: dto.repositoryId,
            projectId,
            organizationId,
          },
          select: {
            id: true,
            name: true,
          },
        });

      if (!repository) {
        throw new NotFoundException(
          'Repository introuvable.',
        );
      }
    }

    let fromDate:
      Date | undefined;

    let toDate:
      Date | undefined;

    if (
      dto.scope ===
      ReportScope.PROJECT
    ) {
      if (
        !dto.fromDate ||
        !dto.toDate
      ) {
        throw new BadRequestException(
          'fromDate et toDate sont obligatoires pour un rapport PROJECT.',
        );
      }

      fromDate =
        new Date(dto.fromDate);

      toDate =
        new Date(dto.toDate);

      if (
        Number.isNaN(
          fromDate.getTime(),
        ) ||
        Number.isNaN(
          toDate.getTime(),
        )
      ) {
        throw new BadRequestException(
          'Période de rapport invalide.',
        );
      }

      if (
        fromDate.getTime() >
        toDate.getTime()
      ) {
        throw new BadRequestException(
          'La date de début doit être antérieure à la date de fin.',
        );
      }
    }

    const filters: JsonObject = {
      scope: dto.scope,

      ...(dto.repositoryId
        ? {
            repositoryId:
              dto.repositoryId,
          }
        : {}),

      ...(fromDate
        ? {
            fromDate:
              fromDate.toISOString(),
          }
        : {}),

      ...(toDate
        ? {
            toDate:
              toDate.toISOString(),
          }
        : {}),
    };

    const scopeLabel =
      dto.scope ===
      ReportScope.SCAN
        ? 'Scan'
        : dto.scope ===
            ReportScope.REPOSITORY
          ? 'Repository'
          : 'Projet';

    const report =
      await this.prisma.report.create({
        data: {
          organizationId,
          projectId,

          scanId:
            dto.scope ===
            ReportScope.SCAN
              ? dto.scanId
              : null,

          requestedById:
            userId,

          status:
            ReportStatus.READY,

          format:
            dto.format,

          name:
            `${scopeLabel} - ${project.name} - ${this.formatDateForName(new Date())}`,

          filters: filters as Prisma.InputJsonValue,

          generatedAt:
            new Date(),

          expiresAt:
            this.addDays(
              new Date(),
              30,
            ),
        },

        select: {
          id: true,
          projectId: true,
          scanId: true,
          format: true,
          status: true,
          name: true,
          filters: true,
          generatedAt: true,
          expiresAt: true,
        },
      });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        projectId,
        actorId: userId,
        action: AuditAction.EXPORT,
        resourceType: 'Report',
        resourceId: report.id,
        description:
          `Rapport ${scopeLabel.toLowerCase()} créé pour le projet ${project.name}.`,
        metadata: {
          scope: dto.scope,
          format: dto.format,
          scanId:
            dto.scanId ?? null,
          repositoryId:
            dto.repositoryId ?? null,
          fromDate:
            fromDate?.toISOString() ??
            null,
          toDate:
            toDate?.toISOString() ??
            null,
        },
      },
    });

    try {
      await this.notifications.create({
        userId,
        type: 'REPORT_READY',
        title: 'Rapport prêt',
        message:
          `Le rapport ${scopeLabel.toLowerCase()} du projet ${project.name} est prêt.`,
        metadata: {
          reportId: report.id,
          projectId,
          organizationId,
          scope: dto.scope,
        },
      });
    } catch {
      // La génération du rapport ne doit pas échouer
      // si la notification n'est pas disponible.
    }

    return {
      ...report,
      scope:
        dto.scope,
    };
  }

  // ==========================================================================
  // DOWNLOAD / GENERATION
  // ==========================================================================

  async downloadPayload(
    organizationId: string,
    projectId: string,
    reportId: string,
    userId: string,
  ) {
    await this.ensureAccess(
      organizationId,
      projectId,
      userId,
    );

    const report =
      await this.prisma.report.findFirst({
        where: {
          id: reportId,
          projectId,
        },
      });

    if (!report) {
      throw new NotFoundException(
        'Rapport introuvable.',
      );
    }

    if (
      report.status ===
      ReportStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Ce rapport a expiré.',
      );
    }

    const source =
      await this.buildSource(
        organizationId,
        projectId,
        report,
      );

    let content: Buffer;
    let mimeType: string;

    if (
      report.format ===
      ReportFormat.JSON
    ) {
      content =
        Buffer.from(
          JSON.stringify(
            source,
            null,
            2,
          ),
          'utf8',
        );

      mimeType =
        'application/json';
    } else if (
      report.format ===
      ReportFormat.HTML
    ) {
      content =
        Buffer.from(
          this.renderHtml(source),
          'utf8',
        );

      mimeType =
        'text/html';
    } else {
      content =
        await this.renderPdf(
          source,
        );

      mimeType =
        'application/pdf';
    }

    const checksum =
      createHash('sha256')
        .update(content)
        .digest('hex');

    await this.prisma.report.update({
      where: {
        id: report.id,
      },

      data: {
        status:
          ReportStatus.READY,

        fileSize:
          BigInt(content.length),

        checksum,

        generatedAt:
          new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        projectId,
        actorId: userId,
        action:
          AuditAction.DOWNLOAD,
        resourceType: 'Report',
        resourceId:
          report.id,
        description:
          `Téléchargement du rapport ${report.name}.`,
        metadata: {
          format:
            report.format,
          scope:
            source.report.scope,
          fileSize:
            content.length,
          checksum,
        },
      },
    });

    return {
      id: report.id,
      format: report.format,
      scope:
        source.report.scope,
      name: report.name,
      mimeType,
      fileSize:
        content.length,
      checksum,
      contentBase64:
        content.toString(
          'base64',
        ),
    };
  }

  // ==========================================================================
  // SOURCE
  // ==========================================================================

  private async buildSource(
    organizationId: string,
    projectId: string,
    report: {
      id: string;
      name: string;
      format: ReportFormat;
      scanId: string | null;
      filters: Prisma.JsonValue | null;
      generatedAt: Date | null;
    },
  ): Promise<ReportSource> {
    const filters =
      this.parseFilters(
        report.filters,
      );

    const scope =
      this.resolveScope(
        filters,
        report.scanId,
      );

    if (
      scope ===
      ReportScope.ORGANIZATION
    ) {
      throw new BadRequestException(
        'Un rapport ORGANIZATION doit utiliser le générateur de rapport organisation.',
      );
    }

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
          status: true,
          defaultBranch: true,

          organization: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable.',
      );
    }

    const from =
      filters.fromDate
        ? new Date(
            filters.fromDate,
          )
        : null;

    const to =
      filters.toDate
        ? this.endOfDay(
            new Date(
              filters.toDate,
            ),
          )
        : null;

    if (
      scope ===
      ReportScope.SCAN
    ) {
      return this.buildScanSource(
        project,
        report,
      );
    }

    if (
      scope ===
      ReportScope.REPOSITORY
    ) {
      return this.buildRepositorySource(
        project,
        report,
        filters.repositoryId,
        from,
        to,
      );
    }

    return this.buildProjectSource(
      project,
      report,
      from,
      to,
    );
  }

  // ==========================================================================
  // SCAN REPORT
  // ==========================================================================

  private async buildScanSource(
    project: any,
    report: any,
  ): Promise<ReportSource> {
    if (!report.scanId) {
      throw new BadRequestException(
        'Le rapport SCAN ne possède aucun scan.',
      );
    }

    const scan =
      await this.prisma.scan.findFirst({
        where: {
          id: report.scanId,
          projectId:
            project.id,

          repository: {
            organizationId:
              project.organization.id,
          },
        },

        include: {
          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
              provider: true,
              primaryLanguage: true,
              defaultBranch: true,
            },
          },

          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

    if (!scan) {
      throw new NotFoundException(
        'Scan introuvable.',
      );
    }

    const findings =
      await this.prisma.finding.findMany({
        where: {
          projectId:
            project.id,
          repository: {
            organizationId:
              project.organization.id,
          },
          OR: [
            {
              scanId:
                scan.id,
            },
            {
              occurrences: {
                some: {
                  scanId:
                    scan.id,
                },
              },
            },
            {
              metadata: {
                path: [
                  'reconciledByScanId',
                ],
                equals:
                  scan.id,
              },
            },
          ],
        },

        orderBy: [
          {
            severity:
              'desc',
          },
          {
            cvssScore:
              'desc',
          },
          {
            firstDetectedAt:
              'desc',
          },
        ],
      });

    const wstgFindings = findings.map((finding) => ({
      severity: String(finding.severity),
      owaspCategory: finding.owaspCategory,
    }));



    const source =
      await this.buildAggregatedSource(
        project,
        report,
        ReportScope.SCAN,
        [scan],
        findings,
        null,
        null,
      );

    return source;
  }

  // ==========================================================================
  // REPOSITORY REPORT
  // ==========================================================================

  private async buildRepositorySource(
    project: any,
    report: any,
    repositoryId:
      string | undefined,
    from:
      Date | null,
    to:
      Date | null,
  ): Promise<ReportSource> {
    if (!repositoryId) {
      throw new BadRequestException(
        'repositoryId absent du rapport repository.',
      );
    }

    const repository =
      await this.prisma.repository.findFirst({
        where: {
          id: repositoryId,
          projectId:
            project.id,
          organizationId:
            project.organization.id,
        },
      });

    if (!repository) {
      throw new NotFoundException(
        'Repository introuvable.',
      );
    }

    const scanWhere: Prisma.ScanWhereInput = {
      projectId:
        project.id,
      repositoryId,
      ...(from || to
        ? {
            createdAt: {
              ...(from
                ? {
                    gte: from,
                  }
                : {}),
              ...(to
                ? {
                    lte: to,
                  }
                : {}),
            },
          }
        : {}),
    };

    const scans =
      await this.prisma.scan.findMany({
        where: scanWhere,
        orderBy: {
          createdAt:
            'desc',
        },

        include: {
          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

    const findings =
      await this.prisma.finding.findMany({
        where: {
          projectId:
            project.id,
          repositoryId,

          ...(from || to
            ? {
                OR: [
                  {
                    firstDetectedAt: {
                      ...(to
                        ? {
                            lte: to,
                          }
                        : {}),
                    },
                  },

                  {
                    updatedAt: {
                      ...(from
                        ? {
                            gte: from,
                          }
                        : {}),
                      ...(to
                        ? {
                            lte: to,
                          }
                        : {}),
                    },
                  },
                ],
              }
            : {}),
        },

        orderBy: [
          {
            severity:
              'desc',
          },
          {
            cvssScore:
              'desc',
          },
        ],
      });

    return this.buildAggregatedSource(
      project,
      report,
      ReportScope.REPOSITORY,
      scans,
      findings,
      repository,
      {
        from,
        to,
      },
    );
  }

  // ==========================================================================
  // PROJECT REPORT
  // ==========================================================================

  private async buildProjectSource(
    project: any,
    report: any,
    from:
      Date | null,
    to:
      Date | null,
  ): Promise<ReportSource> {
    const repositories =
      await this.prisma.repository.findMany({
        where: {
          projectId:
            project.id,
          organizationId:
            project.organization.id,
        },

        orderBy: {
          name: 'asc',
        },
      });

    const scanWhere:
      Prisma.ScanWhereInput = {
      projectId:
        project.id,

      ...(from || to
        ? {
            createdAt: {
              ...(from
                ? {
                    gte: from,
                  }
                : {}),
              ...(to
                ? {
                    lte: to,
                  }
                : {}),
            },
          }
        : {}),
    };

    const scans =
      await this.prisma.scan.findMany({
        where:
          scanWhere,

        orderBy: {
          createdAt:
            'desc',
        },

        include: {
          requestedBy: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },

          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
              provider: true,
              primaryLanguage: true,
              defaultBranch: true,
            },
          },
        },
      });

    const findings =
      await this.prisma.finding.findMany({
        where: {
          projectId:
            project.id,

          repository: {
            organizationId:
              project.organization.id,
          },

          ...(from || to
            ? {
                OR: [
                  {
                    firstDetectedAt: {
                      ...(to
                        ? {
                            lte: to,
                          }
                        : {}),
                    },
                  },

                  {
                    updatedAt: {
                      ...(from
                        ? {
                            gte: from,
                          }
                        : {}),
                      ...(to
                        ? {
                            lte: to,
                          }
                        : {}),
                    },
                  },
                ],
              }
            : {}),
        },

        orderBy: [
          {
            severity:
              'desc',
          },
          {
            cvssScore:
              'desc',
          },
          {
            updatedAt:
              'desc',
          },
        ],

        include: {
          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
            },
          },
        },
      });

    const wstgFindings = findings.map(
      (finding) => ({
        severity: finding.severity,
        owaspCategory:
          finding.owaspCategory,
      }),
    );

    const wstgBreakdown =
      this.buildWstgBreakdown(wstgFindings);

    const wstgScore =
      this.calculateWstgScore(wstgFindings);

    const source =
      await this.buildAggregatedSource(
        project,
        report,
        ReportScope.PROJECT,
        scans,
        findings,
        null,
        {
          from,
          to,
        },
      );

      source.wstg = {
        score: wstgScore,

        grade:
          this.getWstgGrade(
            wstgScore,
          ),

        categories:
          wstgBreakdown,

        totalCategories:
          wstgBreakdown.length,
      };

    // ------------------------------------------------------------------------
    // Remediation history
    // ------------------------------------------------------------------------

    const auditWhere:
      Prisma.AuditLogWhereInput = {
      projectId:
        project.id,

      action:
        AuditAction.CHANGE_STATUS,

      resourceType:
        'Finding',

      ...(from || to
        ? {
            createdAt: {
              ...(from
                ? {
                    gte: from,
                  }
                : {}),
              ...(to
                ? {
                    lte: to,
                  }
                : {}),
            },
          }
        : {}),
    };

    const auditLogs =
      await this.prisma.auditLog.findMany({
        where:
          auditWhere,

        orderBy: {
          createdAt:
            'desc',
        },

        take: 1000,

        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

    const findingIds =
      auditLogs
        .map(
          (item) =>
            item.resourceId,
        )
        .filter(
          (
            id,
          ): id is string =>
            Boolean(id),
        );

    const auditedFindings =
      findingIds.length
        ? await this.prisma.finding.findMany({
            where: {
              id: {
                in: findingIds,
              },
              projectId:
                project.id,
            },

            select: {
              id: true,
              title: true,
              repository: {
                select: {
                  name: true,
                },
              },
            },
          })
        : [];

    const findingMap =
      new Map(
        auditedFindings.map(
          (finding) => [
            finding.id,
            finding,
          ],
        ),
      );

    source.remediation =
      auditLogs
        .map((log) => {
          const metadata =
            this.asObject(
              log.metadata,
            );

          const finding =
            log.resourceId
              ? findingMap.get(
                  log.resourceId,
                )
              : undefined;

          const actor =
            log.actor
              ? this.displayUser(
                  log.actor,
                )
              : 'Système';

          const previousStatus =
            this.stringValue(
              metadata.previousStatus,
            );

          const newStatus =
            this.stringValue(
              metadata.newStatus,
            );

      const isRemediation =
        (newStatus !== null &&
          this.remediationStatuses.has(
            newStatus as FindingStatus,
          )) ||
        (previousStatus !== null &&
          this.remediationStatuses.has(
            previousStatus as FindingStatus,
          ));

          if (
            !isRemediation ||
            !finding
          ) {
            return null;
          }

          return {
            findingId:
              finding.id,

            findingTitle:
              finding.title,

            repository:
              finding.repository
                .name,

            actor,

            action:
              log.action,

            previousStatus,

            newStatus,

            comment:
              this.stringValue(
                metadata.comment,
              ),

            date:
              log.createdAt.toISOString(),
          };
        })
        .filter(
          (
            item,
          ): item is NonNullable<
            typeof item
          > =>
            Boolean(item),
        );

    // ------------------------------------------------------------------------
    // Full audit trail
    // ------------------------------------------------------------------------

    const auditTrail =
      await this.prisma.auditLog.findMany({
        where: {
          projectId:
            project.id,

          ...(from || to
            ? {
                createdAt: {
                  ...(from
                    ? {
                        gte: from,
                      }
                    : {}),
                  ...(to
                    ? {
                        lte: to,
                      }
                    : {}),
                },
              }
            : {}),
        },

        orderBy: {
          createdAt:
            'desc',
        },

        take: 1000,

        include: {
          actor: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

    source.auditTrail =
      auditTrail.map(
        (log) => ({
          id: log.id,

          actor:
            log.actor
              ? this.displayUser(
                  log.actor,
                )
              : 'Système',

          action:
            log.action,

          resourceType:
            log.resourceType,

          resourceId:
            log.resourceId,

          description:
            log.description,

          date:
            log.createdAt.toISOString(),
        }),
      );

    source.recommendations =
      this.buildRecommendations(
        source,
      );

    source.conclusion =
      this.buildProjectConclusion(
        source,
      );

    return source;
  }

  // ==========================================================================
  // AGGREGATION
  // ==========================================================================

  private async buildAggregatedSource(
    project: any,
    report: any,
    scope: ReportScope,
    scans: any[],
    findings: any[],
    selectedRepository:
      any | null,
    period:
      {
        from: Date | null;
        to: Date | null;
      } | null,
  ): Promise<ReportSource> {
    const repositories =
      selectedRepository
        ? [selectedRepository]
        : await this.prisma.repository.findMany({
            where: {
              projectId:
                project.id,
              organizationId:
                project.organization.id,
            },
            orderBy: {
              name: 'asc',
            },
          });

    const severity =
      this.countBy(
        findings,
        (finding) =>
          finding.severity,
      );

    const status =
      this.countBy(
        findings,
        (finding) =>
          finding.status,
      );

    const activeFindings =
      findings.filter(
        (finding) =>
          !this.isResolvedStatus(
            finding.status,
          ),
      );

    const resolvedFindings =
      findings.filter(
        (finding) =>
          this.isResolvedStatus(
            finding.status,
          ),
      );

    const scores =
      scans
        .map(
          (scan) =>
            scan.score !== null &&
            scan.score !== undefined
              ? Number(
                  scan.score,
                )
              : null,
        )
        .filter(
          (
            value,
          ): value is number =>
            value !== null,
        );

    const averageScore =
      scores.length
        ? this.round(
            scores.reduce(
              (
                sum,
                value,
              ) =>
                sum + value,
              0,
            ) /
              scores.length,
            2,
          )
        : null;

    const latestScore =
      scans.length &&
      scans[0].score !== null &&
      scans[0].score !== undefined
        ? Number(
            scans[0].score,
          )
        : null;

    const remediationRate =
      findings.length
        ? this.round(
            (resolvedFindings.length /
              findings.length) *
              100,
            1,
          )
        : 100;

    const critical =
      severity.CRITICAL ?? 0;

    const high =
      severity.HIGH ?? 0;

    const medium =
      severity.MEDIUM ?? 0;

    const low =
      severity.LOW ?? 0;

    const info =
      severity.INFO ?? 0;

    const riskLevel =
      this.calculateRiskLevel(
        critical,
        high,
        medium,
        activeFindings.length,
      );

    const categories =
      this.countNamed(
        findings,
        (finding) =>
          finding.category,
      );

    const owasp =
      this.countNamed(
        findings,
        (finding) =>
          finding.owaspCategory ??
          'Non classé OWASP',
      );

    const cwe =
      this.countNamed(
        findings,
        (finding) =>
          finding.cweId ??
          'CWE non renseigné',
      );

    const wstgFindings =
      findings.map(
        (finding) => ({
          severity:
            String(
              finding.severity,
            ),
          owaspCategory:
            finding.owaspCategory,
        }),
      );

    const repositoryReports =
      repositories.map(
        (repository) => {
          const repositoryScans =
            scans.filter(
              (scan) =>
                scan.repositoryId ===
                repository.id,
            );

          const repositoryFindings =
            findings.filter(
              (finding) =>
                finding.repositoryId ===
                repository.id,
            );

          const active =
            repositoryFindings.filter(
              (finding) =>
                !this.isResolvedStatus(
                  finding.status,
                ),
            );

          const repoSeverity =
            this.countBy(
              repositoryFindings,
              (finding) =>
                finding.severity,
            );

          const latest =
            repositoryScans[0];

          return {
            id:
              repository.id,

            name:
              repository.name,

            fullName:
              repository.fullName,

            provider:
              repository.provider,

            primaryLanguage:
              repository.primaryLanguage,

            defaultBranch:
              repository.defaultBranch,

            scans:
              repositoryScans.length,

            findings:
              repositoryFindings.length,

            activeFindings:
              active.length,

            critical:
              repoSeverity.CRITICAL ??
              0,

            high:
              repoSeverity.HIGH ??
              0,

            latestScore:
              latest?.score !== null &&
              latest?.score !== undefined
                ? Number(
                    latest.score,
                  )
                : null,
          };
        },
      );

    const source: ReportSource =
      {
        report: {
          id:
            report.id,

          name:
            report.name,

          format:
            report.format,

          scope,

          generatedAt:
            new Date().toISOString(),
        },

        organization: {
          id:
            project.organization.id,

          name:
            project.organization.name,
        },

        project: {
          id:
            project.id,

          name:
            project.name,

          slug:
            project.slug,

          description:
            project.description,

          status:
            project.status,

          defaultBranch:
            project.defaultBranch,
        },

        period: {
          from:
            period?.from
              ? period.from.toISOString()
              : null,

          to:
            period?.to
              ? period.to.toISOString()
              : null,
        },

        summary: {
          repositories:
            repositories.length,

          scans:
            scans.length,

          completedScans:
            scans.filter(
              (scan) =>
                scan.status ===
                'COMPLETED',
            ).length,

          failedScans:
            scans.filter(
              (scan) =>
                scan.status ===
                'FAILED',
            ).length,

          findings:
            findings.length,

          activeFindings:
            activeFindings.length,

          resolvedFindings:
            resolvedFindings.length,

          critical,

          high,

          medium,

          low,

          info,

          averageScore,

          latestScore,

          remediationRate,

          riskLevel,
        },

        severity,

        status,

        categories,

        owasp,

        cwe,

        repositories:
          repositoryReports,

        scans:
          scans.map(
            (scan) => ({
              id:
                scan.id,

              repository:
                scan.repository
                  ?.name ??
                selectedRepository?.name ??
                'Repository',

              repositoryId:
                scan.repositoryId,

              type:
                scan.type,

              trigger:
                scan.trigger,

              status:
                scan.status,

              branch:
                scan.branch,

              commitSha:
                scan.commitSha,

              score:
                scan.score !== null &&
                scan.score !== undefined
                  ? Number(
                      scan.score,
                    )
                  : null,

              requestedBy:
                scan.requestedBy
                  ? this.displayUser(
                      scan.requestedBy,
                    )
                  : null,

              createdAt:
                scan.createdAt.toISOString(),

              completedAt:
                scan.completedAt
                  ? scan.completedAt.toISOString()
                  : null,
            }),
          ),

        findings:
          findings.map(
            (finding) => ({
              id:
                finding.id,

              repository:
                finding.repository
                  ?.name ??
                selectedRepository?.name ??
                'Repository',

              scanId:
                finding.scanId,

              title:
                finding.title,

              severity:
                finding.severity,

              status:
                finding.status,

              category:
                finding.category,

              owaspCategory:
                finding.owaspCategory,

              cweId:
                finding.cweId,

              cvssScore:
                finding.cvssScore
                  ? Number(
                      finding.cvssScore,
                    )
                  : null,

              scanner:
                finding.scanner,

              ruleId:
                finding.ruleId,

              filePath:
                finding.filePath,

              startLine:
                finding.startLine,

              endLine:
                finding.endLine,

              confidence:
                finding.confidence
                  ? Number(
                      finding.confidence,
                    )
                  : null,

              recommendation:
                finding.recommendation,

              firstDetectedAt:
                finding.firstDetectedAt.toISOString(),

              lastDetectedAt:
                finding.lastDetectedAt.toISOString(),

              resolvedAt:
                finding.resolvedAt
                  ? finding.resolvedAt.toISOString()
                  : null,
            }),
          ),

        remediation: [],

        auditTrail: [],

        recommendations: [],

        conclusion: '',
      };

    const wstgCategories =
      this.buildWstgBreakdown(
        wstgFindings,
      );

    const wstgScore =
      this.calculateWstgScore(
        wstgFindings,
      );

    source.wstg = {
      score:
        wstgScore,
      grade:
        this.getWstgGrade(
          wstgScore,
        ),
      categories:
        wstgCategories,
      totalCategories:
        wstgCategories.length,
    };

    source.recommendations =
      this.buildRecommendations(
        source,
      );

    source.conclusion =
      scope ===
      ReportScope.SCAN
        ? this.buildScanConclusion(
            source,
          )
        : this.buildProjectConclusion(
            source,
          );

    return source;
  }

  // ==========================================================================
  // RECOMMENDATIONS
  // ==========================================================================

  private buildRecommendations(
    source: ReportSource,
  ): string[] {
    const recommendations: string[] =
      [];

    if (
      source.summary.critical >
      0
    ) {
      recommendations.push(
        `Traiter en priorité les ${source.summary.critical} vulnérabilité(s) critique(s) encore présentes dans le périmètre analysé.`,
      );
    }

    if (
      source.summary.high >
      0
    ) {
      recommendations.push(
        `Planifier rapidement la remédiation des ${source.summary.high} vulnérabilité(s) de niveau élevé.`,
      );
    }

    if (
      source.summary.activeFindings >
      0
    ) {
      recommendations.push(
        `Poursuivre le traitement des ${source.summary.activeFindings} finding(s) actuellement non résolus et maintenir leur suivi jusqu'à validation.`,
      );
    }

    if (
      source.summary.remediationRate <
      70
    ) {
      recommendations.push(
        `Le taux de remédiation est de ${source.summary.remediationRate} %. Il est recommandé de renforcer le suivi des actions correctives et les échéances de traitement.`,
      );
    }

    if (
      source.summary.averageScore !==
        null &&
      source.summary.averageScore <
        70
    ) {
      recommendations.push(
        `Le score de sécurité moyen est de ${source.summary.averageScore}/100. Une revue prioritaire des vulnérabilités à fort impact est recommandée.`,
      );
    }

    if (
      source.categories.length >
      0
    ) {
      const top =
        source.categories[0];

      recommendations.push(
        `Concentrer les actions préventives sur la catégorie de vulnérabilités la plus représentée : ${top.name} (${top.count} occurrence(s)).`,
      );
    }

    if (
      source.owasp.length >
      0
    ) {
      const top =
        source.owasp[0];

      recommendations.push(
        `Renforcer les contrôles de sécurité associés à ${top.name}, qui constitue la catégorie OWASP la plus représentée dans le périmètre.`,
      );
    }

    if (
      recommendations.length ===
      0
    ) {
      recommendations.push(
        'Maintenir une surveillance régulière du code, conserver les scans de sécurité dans le cycle de développement et vérifier périodiquement les findings historiques.',
      );
    }

    return recommendations.slice(
      0,
      8,
    );
  }

  // ==========================================================================
  // CONCLUSIONS
  // ==========================================================================

  private buildScanConclusion(
    source: ReportSource,
  ): string {
    const {
      summary,
    } = source;

    if (
      summary.critical >
      0
    ) {
      return `Le scan met en évidence ${summary.critical} vulnérabilité(s) critique(s) et ${summary.high} vulnérabilité(s) élevée(s). Le périmètre doit faire l'objet d'actions correctives prioritaires avant de considérer le niveau de risque comme maîtrisé.`;
    }

    if (
      summary.high >
      0
    ) {
      return `Le scan met en évidence des vulnérabilités de niveau élevé nécessitant une remédiation prioritaire. Une nouvelle analyse devra être effectuée après correction afin de confirmer leur résolution.`;
    }

    if (
      summary.activeFindings >
      0
    ) {
      return `Le scan ne présente pas de vulnérabilité critique, mais ${summary.activeFindings} finding(s) restent actifs. Une surveillance et une remédiation progressive sont recommandées.`;
    }

    return 'Le scan ne présente aucun finding actif dans le périmètre analysé. Il est recommandé de maintenir les contrôles de sécurité et de poursuivre les analyses régulières.';
  }

  private buildProjectConclusion(
    source: ReportSource,
  ): string {
    const {
      summary,
    } = source;

    return `Sur la période analysée, le projet ${source.project.name} compte ${summary.scans} scan(s), ${summary.findings} finding(s) et ${summary.activeFindings} finding(s) encore actifs. Le niveau de risque global est évalué à ${summary.riskLevel}. Le taux de remédiation observé est de ${summary.remediationRate} %. Les actions prioritaires doivent porter sur les vulnérabilités critiques et élevées ainsi que sur les catégories récurrentes identifiées dans le présent rapport.`;
  }

  // ==========================================================================
  // HTML
  // ==========================================================================

  private renderHtml(
    source: ReportSource,
  ): string {
    const isScan =
      source.report.scope ===
      ReportScope.SCAN;

    const scopeTitle =
      isScan
        ? 'Rapport de sécurité du scan'
        : source.report.scope ===
            ReportScope.REPOSITORY
          ? 'Rapport de sécurité du repository'
          : 'Rapport global de sécurité du projet';

    const period =
      source.period.from &&
      source.period.to
        ? `${this.formatDate(
            source.period.from,
          )} — ${this.formatDate(
            source.period.to,
          )}`
        : 'Période non spécifiée';

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">

<title>${this.escapeHtml(
      scopeTitle,
    )}</title>

<style>

@page {
  size: A4;
  margin: 18mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  background: #f3f5f8;
  color: #172033;
  font-family:
    Inter,
    Arial,
    Helvetica,
    sans-serif;
  line-height: 1.55;
}

.page {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto 24px;
  background: #ffffff;
  padding: 42px;
}

.cover {
  min-height: 900px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-top: 8px solid #172033;
}

.brand {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 2px;
}

.cover h1 {
  margin: 50px 0 15px;
  font-size: 42px;
  line-height: 1.1;
  color: #172033;
}

.cover .subtitle {
  font-size: 21px;
  color: #667085;
  max-width: 680px;
}

.meta {
  margin-top: 45px;
  display: grid;
  grid-template-columns:
    repeat(2, 1fr);
  gap: 18px;
}

.meta-item {
  padding: 18px;
  background: #f7f8fa;
  border: 1px solid #e4e7ec;
}

.meta-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: #667085;
  margin-bottom: 5px;
}

.meta-value {
  font-size: 16px;
  font-weight: 700;
}

.footer {
  margin-top: 40px;
  padding-top: 18px;
  border-top: 1px solid #e4e7ec;
  color: #667085;
  font-size: 11px;
}

h2 {
  font-size: 24px;
  margin: 0 0 22px;
  padding-bottom: 10px;
  border-bottom: 2px solid #172033;
}

h3 {
  font-size: 17px;
  margin-top: 28px;
}

p {
  margin: 8px 0;
}

.grid {
  display: grid;
  grid-template-columns:
    repeat(4, 1fr);
  gap: 12px;
}

.card {
  border: 1px solid #e4e7ec;
  padding: 17px;
  background: #fff;
}

.card-label {
  color: #667085;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .6px;
}

.card-value {
  margin-top: 6px;
  font-size: 25px;
  font-weight: 800;
}

.score {
  font-size: 34px;
  font-weight: 800;
}

.risk {
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
}

.severity-grid {
  display: grid;
  grid-template-columns:
    repeat(5, 1fr);
  gap: 10px;
}

.severity {
  padding: 15px;
  border: 1px solid #e4e7ec;
  text-align: center;
}

.severity strong {
  display: block;
  font-size: 23px;
}

.severity span {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  text-transform: uppercase;
  color: #667085;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 12px;
  font-size: 11px;
}

th {
  text-align: left;
  padding: 10px;
  background: #172033;
  color: #fff;
  font-weight: 700;
}

td {
  padding: 9px 10px;
  border-bottom: 1px solid #e4e7ec;
  vertical-align: top;
}

tr:nth-child(even) td {
  background: #fafbfc;
}

.badge {
  display: inline-block;
  padding: 4px 8px;
  border: 1px solid #d0d5dd;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.finding {
  border: 1px solid #dfe3e8;
  margin-bottom: 18px;
  page-break-inside: avoid;
}

.finding-header {
  padding: 14px 17px;
  background: #f7f8fa;
  border-bottom: 1px solid #dfe3e8;
}

.finding-title {
  font-size: 15px;
  font-weight: 800;
}

.finding-body {
  padding: 17px;
}

.finding-grid {
  display: grid;
  grid-template-columns:
    repeat(2, 1fr);
  gap: 8px 20px;
}

.label {
  color: #667085;
  font-size: 10px;
  text-transform: uppercase;
}

.value {
  font-size: 12px;
  font-weight: 600;
}

.recommendation {
  margin-top: 15px;
  padding: 14px;
  background: #f7f8fa;
  border-left: 3px solid #172033;
}

ul {
  padding-left: 20px;
}

li {
  margin: 7px 0;
}

.muted {
  color: #667085;
}

.small {
  font-size: 10px;
}

.section {
  page-break-inside: auto;
}

.page-break {
  page-break-before: always;
}

.integrity {
  font-family:
    monospace;
  word-break: break-all;
  font-size: 10px;
}

@media print {
  body {
    background: #fff;
  }

  .page {
    margin: 0;
    max-width: none;
    box-shadow: none;
  }
}

</style>
</head>

<body>

<section class="page cover">

  <div>
    <div class="brand">
      SECURECODE
    </div>

    <h1>
      ${this.escapeHtml(
        scopeTitle,
      )}
    </h1>

    <div class="subtitle">
      Analyse et suivi de la posture de sécurité
      du projet
      <strong>${this.escapeHtml(
        source.project.name,
      )}</strong>.
    </div>

    <div class="meta">

      <div class="meta-item">
        <span class="meta-label">
          Organisation
        </span>
        <span class="meta-value">
          ${this.escapeHtml(
            source.organization.name,
          )}
        </span>
      </div>

      <div class="meta-item">
        <span class="meta-label">
          Projet
        </span>
        <span class="meta-value">
          ${this.escapeHtml(
            source.project.name,
          )}
        </span>
      </div>

      <div class="meta-item">
        <span class="meta-label">
          Période
        </span>
        <span class="meta-value">
          ${this.escapeHtml(
            period,
          )}
        </span>
      </div>

      <div class="meta-item">
        <span class="meta-label">
          Généré le
        </span>
        <span class="meta-value">
          ${this.formatDate(
            source.report.generatedAt,
          )}
        </span>
      </div>

    </div>
  </div>

  <div class="footer">
    Document généré par SecureCode.
    Rapport destiné au suivi de la sécurité
    du code et à la traçabilité des actions
    de remédiation.
  </div>

</section>


<section class="page">

<h2>1. Synthèse exécutive</h2>

<p>
  Le présent rapport présente les résultats de sécurité
  observés sur le périmètre
  <strong>${this.escapeHtml(
    source.project.name,
  )}</strong>.
</p>

<div class="grid">

  ${this.htmlCard(
    'Repositories',
    source.summary.repositories,
  )}

  ${this.htmlCard(
    'Scans',
    source.summary.scans,
  )}

  ${this.htmlCard(
    'Findings',
    source.summary.findings,
  )}

  ${this.htmlCard(
    'Findings actifs',
    source.summary.activeFindings,
  )}

  ${this.htmlCard(
    'Critiques',
    source.summary.critical,
  )}

  ${this.htmlCard(
    'Élevés',
    source.summary.high,
  )}

  ${this.htmlCard(
    'Corrigés',
    source.summary.resolvedFindings,
  )}

  ${this.htmlCard(
    'Remédiation',
    `${source.summary.remediationRate}%`,
  )}

</div>

<h3>Score de sécurité</h3>

<div class="card">
  <span class="card-label">
    Dernier score
  </span>

  <div class="score">
    ${
      source.summary.latestScore ??
      'N/A'
    }
    ${
      source.summary.latestScore !==
      null
        ? '/100'
        : ''
    }
  </div>

  <div class="risk">
    Niveau de risque :
    ${this.escapeHtml(
      source.summary.riskLevel,
    )}
  </div>
</div>

</section>


<section class="page">

<h2>2. Répartition des vulnérabilités</h2>

<div class="severity-grid">

  ${this.htmlSeverity(
    'Critical',
    source.summary.critical,
  )}

  ${this.htmlSeverity(
    'High',
    source.summary.high,
  )}

  ${this.htmlSeverity(
    'Medium',
    source.summary.medium,
  )}

  ${this.htmlSeverity(
    'Low',
    source.summary.low,
  )}

  ${this.htmlSeverity(
    'Info',
    source.summary.info,
  )}

</div>

<h3>Statuts</h3>

${this.htmlCountTable(
  source.status,
  'Statut',
)}

<h3>Catégories</h3>

${this.htmlNamedTable(
  source.categories,
  'Catégorie',
)}

<h3>OWASP</h3>

${this.htmlNamedTable(
  source.owasp,
  'Catégorie OWASP',
)}

<h3>CWE</h3>

${this.htmlNamedTable(
  source.cwe,
  'CWE',
)}

</section>


<section class="page">

<h2>3. Repositories</h2>

${this.htmlRepositories(
  source,
)}

</section>


<section class="page">

<h2>
${
  source.report.scope ===
  ReportScope.SCAN
    ? '4. Scan analysé'
    : '4. Historique des scans'
}
</h2>

${this.htmlScans(
  source,
)}

</section>


${
  source.report.scope ===
  ReportScope.PROJECT
    ? `
<section class="page">

<h2>5. Activité de remédiation</h2>

<p class="muted">
  Historique des changements de statut
  enregistrés pendant la période du rapport.
</p>

${this.htmlRemediation(
  source,
)}

</section>

<section class="page">

<h2>6. Journal d'audit</h2>

${this.htmlAudit(
  source,
)}

</section>
`
    : ''
}


<section class="page">

<h2>${
      source.report.scope ===
      ReportScope.PROJECT
        ? '7'
        : '5'
    }. Findings</h2>

${this.htmlFindings(
  source,
)}

</section>


<section class="page">

<h2>${
      source.report.scope ===
      ReportScope.PROJECT
        ? '8'
        : '6'
    }. Recommandations</h2>

<ul>

${source.recommendations
  .map(
    (recommendation) =>
      `<li> <strong> ${this.escapeHtml(
        recommendation,
      )}<strong></li>`,

  )
  .join('')}

</ul>

<h3>Conclusion</h3>

<p>
  ${this.escapeHtml(
    source.conclusion,
  )}
</p>

</section>


<section class="page">

<h2>${
      source.report.scope ===
      ReportScope.PROJECT
        ? '9'
        : '7'
    }. Intégrité du rapport</h2>

<p>
  Le fichier final est associé à une empreinte
  SHA-256 calculée lors de son téléchargement.
</p>

<p class="muted small">
  L'empreinte définitive est enregistrée
  par SecureCode dans la fiche du rapport.
</p>

<p class="footer">
  SecureCode — Security Reporting Platform
</p>

</section>

</body>
</html>
`;
  }

  // ==========================================================================
  // PDF
  // ==========================================================================

  private renderPdf(
    source: ReportSource,
  ): Promise<Buffer> {
    return new Promise(
      (resolve, reject) => {
      const doc =
        new PDFDocument({
          size: 'A4',

          margins: {
            top: 62,
            bottom: 55,
            left: 48,
            right: 48,
          },

          bufferPages:
            true,

          info: {
            Title:
              source.report.name,

            Author:
              'SecureCode',

            Subject:
              'Security Assessment Report',
          },
        });

        const chunks: Buffer[] =
          [];

        doc.on(
          'data',
          (chunk) =>
            chunks.push(
              Buffer.from(chunk),
            ),
        );

        doc.on(
          'end',
          () =>
            resolve(
              Buffer.concat(
                chunks,
              ),
            ),
        );

        doc.on(
          'error',
          reject,
        );

        const width =
          doc.page.width -
          96;

        const reportContextName =
          source.project.name;

        const sectionTitle =
          (
            title: string,
            subtitle?: string,
          ) => {
            if (
              doc.y >
              doc.page.height -
                doc.page.margins.bottom -
                90
            ) {
              doc.addPage();
            }

            doc.moveDown(
              0.7,
            );

            const y =
              doc.y;

            doc
              .roundedRect(
                48,
                y,
                5,
                28,
                2,
              )
              .fill(
                '#2563EB',
              );

            doc
              .font(
                'Helvetica-Bold',
              )
              .fontSize(
                17,
              )
              .fillColor(
                '#172033',
              )
              .text(
                title,
                66,
                y + 3,
                {
                  width:
                    width - 18,
                },
              );

            doc.y =
              y + 38;

            if (
              subtitle
            ) {
              doc
                .font(
                  'Helvetica',
                )
                .fontSize(
                  9,
                )
                .fillColor(
                  '#667085',
                )
                .text(
                  subtitle,
                  66,
                  doc.y,
                  {
                    width:
                      width - 18,
                  },
                );

              doc.moveDown(
                0.5,
              );
            }
          };

        const labelValue =
          (
            label: string,
            value: string,
          ) => {
            doc
              .fontSize(9)
              .font(
                'Helvetica-Bold',
              )
              .fillColor('#667085')
              .text(
                label.toUpperCase(),
              );

            doc
              .fontSize(11)
              .font(
                'Helvetica',
              )
              .fillColor('#172033')
              .text(
                value ||
                  'N/A',
              );

            doc.moveDown(
              0.35,
            );
          };

        const stat =
          (
            label: string,
            value: string,
            color =
              '#2563EB',
          ) => {
            const x =
              doc.x;

            const y =
              doc.y;

            const cardWidth =
              120;

            const cardHeight =
              64;

            doc
              .roundedRect(
                x,
                y,
                cardWidth,
                cardHeight,
                7,
              )
              .fillAndStroke(
                '#F8FAFC',
                '#E2E8F0',
              );

            doc
              .roundedRect(
                x,
                y,
                5,
                cardHeight,
                3,
              )
              .fill(
                color,
              );

            doc
              .font(
                'Helvetica-Bold',
              )
              .fontSize(
                8,
              )
              .fillColor(
                '#64748B',
              )
              .text(
                label.toUpperCase(),
                x + 16,
                y + 11,
                {
                  width:
                    cardWidth - 24,
                },
              );

            doc
              .font(
                'Helvetica-Bold',
              )
              .fontSize(
                21,
              )
              .fillColor(
                '#0F172A',
              )
              .text(
                value,
                x + 16,
                y + 30,
                {
                  width:
                    cardWidth - 24,
                },
              );

            doc.x =
              x + 130;

            doc.y =
              y;
          };

        // --------------------------------------------------------------------
        // COVER
        // --------------------------------------------------------------------
// --------------------------------------------------------------------
// COVER
// --------------------------------------------------------------------

    const coverLeft =
      48;

    const coverWidth =
      doc.page.width -
      96;

    const riskColor =
      source.summary.riskLevel ===
      'CRITIQUE'
        ? '#DC2626'
        : source.summary.riskLevel ===
            'ÉLEVÉ'
          ? '#EA580C'
          : source.summary.riskLevel ===
              'MOYEN'
            ? '#CA8A04'
            : '#16A34A';

    const scopeLabel =
      source.report.scope ===
      ReportScope.SCAN
        ? 'RAPPORT DE SCAN'
        : source.report.scope ===
            ReportScope.REPOSITORY
          ? 'RAPPORT REPOSITORY'
          : 'RAPPORT PROJET';

    /*
    * Marque SecureCode.
    */
    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor('#172033')
      .text(
        'SECURECODE',
        coverLeft,
        62,
        {
          characterSpacing: 2,
        },
      );

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor('#64748B')
      .text(
        'CODE SECURITY PLATFORM',
        coverLeft,
        87,
        {
          characterSpacing: 1,
        },
      );

    /*
    * Badge du type de rapport.
    */
    const scopeBadgeWidth =
      150;

    doc
      .roundedRect(
        doc.page.width -
          coverLeft -
          scopeBadgeWidth,
        62,
        scopeBadgeWidth,
        28,
        14,
      )
      .fill('#EFF6FF');

    doc
      .font('Helvetica-Bold')
      .fontSize(8)
      .fillColor('#2563EB')
      .text(
        scopeLabel,
        doc.page.width -
          coverLeft -
          scopeBadgeWidth,
        72,
        {
          width:
            scopeBadgeWidth,

          align:
            'center',

          characterSpacing:
            0.5,
        },
      );

    /*
    * Ligne principale.
    */
    doc
      .roundedRect(
        coverLeft,
        128,
        7,
        112,
        3,
      )
      .fill('#2563EB');

    doc
      .font('Helvetica-Bold')
      .fontSize(27)
      .fillColor('#0F172A')
      .text(
        source.report.scope ===
          ReportScope.SCAN
          ? 'Rapport de sécurité\ndu scan'
          : source.report.scope ===
              ReportScope.REPOSITORY
            ? 'Rapport de sécurité\ndu repository'
            : 'Rapport global de\nsécurité du projet',
        coverLeft + 24,
        127,
        {
          width:
            coverWidth - 24,

          lineGap:
            4,
        },
      );

    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor('#64748B')
      .text(
        source.project.name,
        coverLeft + 24,
        222,
        {
          width:
            coverWidth - 24,
        },
      );

    /*
    * Résumé du niveau de sécurité.
    */


    /*
    * Informations du rapport.
    */
    const informationY =
      425;

    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor('#0F172A')
      .text(
        'Informations du rapport',
        coverLeft,
        informationY,
      );

    doc
      .strokeColor('#E2E8F0')
      .lineWidth(1)
      .moveTo(
        coverLeft,
        informationY + 24,
      )
      .lineTo(
        coverLeft + coverWidth,
        informationY + 24,
      )
      .stroke();

    const drawCoverInformation =
      (
        label: string,
        value: string,
        x: number,
        y: number,
        itemWidth: number,
      ) => {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#64748B')
          .text(
            label.toUpperCase(),
            x,
            y,
            {
              width:
                itemWidth,
            },
          );

        doc
          .font('Helvetica')
          .fontSize(11)
          .fillColor('#172033')
          .text(
            value ||
              'N/A',
            x,
            y + 17,
            {
              width:
                itemWidth,

              height:
                32,

              ellipsis:
                true,
            },
          );
      };

    const informationColumnWidth =
      225;

    drawCoverInformation(
      'Organisation',
      source.organization.name,
      coverLeft,
      informationY + 46,
      informationColumnWidth,
    );

    drawCoverInformation(
      'Projet',
      source.project.name,
      coverLeft + 270,
      informationY + 46,
      informationColumnWidth,
    );

    drawCoverInformation(
      'Statut du projet',
      source.project.status,
      coverLeft,
      informationY + 105,
      informationColumnWidth,
    );

    drawCoverInformation(
      'Branche par défaut',
      source.project.defaultBranch ??
        'Non spécifiée',
      coverLeft + 270,
      informationY + 105,
      informationColumnWidth,
    );

    drawCoverInformation(
      'Période analysée',
      source.period.from &&
      source.period.to
        ? `${this.formatDate(
            source.period.from,
          )} - ${this.formatDate(
            source.period.to,
          )}`
        : 'Non spécifiée',
      coverLeft,
      informationY + 164,
      informationColumnWidth,
    );

    drawCoverInformation(
      'Généré le',
      this.formatDate(
        source.report.generatedAt,
      ),
      coverLeft + 270,
      informationY + 164,
      informationColumnWidth,
    );

    /*
    * Indicateurs supplémentaires.
    */
    const indicatorY =
      informationY + 235;

    const indicatorWidth =
      155;

    const indicatorGap =
      17;

    const drawCoverIndicator =
      (
        label: string,
        value: string,
        index: number,
        color: string,
      ) => {
        const x =
          coverLeft +
          index *
            (
              indicatorWidth +
              indicatorGap
            );

        doc
          .roundedRect(
            x,
            indicatorY,
            indicatorWidth,
            55,
            7,
          )
          .fillAndStroke(
            '#F8FAFC',
            '#E2E8F0',
          );

        doc
          .roundedRect(
            x,
            indicatorY,
            5,
            55,
            3,
          )
          .fill(color);

        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor('#64748B')
          .text(
            label.toUpperCase(),
            x + 15,
            indicatorY + 10,
            {
              width:
                indicatorWidth - 25,
            },
          );

        doc
          .font('Helvetica-Bold')
          .fontSize(17)
          .fillColor('#0F172A')
          .text(
            value,
            x + 15,
            indicatorY + 27,
            {
              width:
                indicatorWidth - 25,
            },
          );
      };



    /*
    * Mention de confidentialité.
    */



    doc.addPage();

        // --------------------------------------------------------------------
        // EXECUTIVE SUMMARY
        // --------------------------------------------------------------------

        sectionTitle(
          '1. Synthèse exécutive',
        );

        doc
          .fontSize(11)
          .font('Helvetica')
          .fillColor('#172033')
          .text(
            `Le présent rapport présente la posture de sécurité observée sur le périmètre du projet ${source.project.name}.`,
            {
              width,
            },
          );



        stat(
          'Repositories',
          String(
            source.summary
              .repositories,
          ),
          '#2563EB',
        );

        stat(
          'Scans',
          String(
            source.summary.scans,
          ),
          '#7C3AED',
        );

        stat(
          'Findings',
          String(
            source.summary.findings,
          ),
          '#0F766E',
        );

        stat(
          'Actifs',
          String(
            source.summary
              .activeFindings,
          ),
          '#D97706',
        );

        doc.x = 48;

        doc.y += 72;

        stat(
          'Critical',
          String(
            source.summary
              .critical,
          ),
          '#DC2626',
        );

        stat(
          'High',
          String(
            source.summary.high,
          ),
          '#EA580C',
        );

        stat(
          'Corrigés',
          String(
            source.summary
              .resolvedFindings,
          ),
          '#16A34A',
        );

        stat(
          'Remédiation',
          `${source.summary.remediationRate}%`,
          '#0891B2',
        );

        doc.x = 48;

        doc.y += 72;

  const score =
    source.summary.latestScore;

  const scoreColor =
    score === null
      ? '#64748B'
      : score >= 80
        ? '#16A34A'
        : score >= 60
          ? '#CA8A04'
          : score >= 40
            ? '#EA580C'
            : '#DC2626';

  const scoreY =
    doc.y;

  doc
    .roundedRect(
      48,
      scoreY,
      width,
      82,
      8,
    )
    .fillAndStroke(
      '#F8FAFC',
      '#E2E8F0',
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#64748B')
    .text(
      'SCORE DE SÉCURITÉ',
      64,
      scoreY + 14,
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(26)
    .fillColor(scoreColor)
    .text(
      score !== null
        ? `${score}/100`
        : 'N/A',
      64,
      scoreY + 33,
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#64748B')
    .text(
      'SCORE MOYEN',
      220,
      scoreY + 14,
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#172033')
    .text(
      source.summary.averageScore !== null
        ? `${source.summary.averageScore}/100`
        : 'N/A',
      220,
      scoreY + 37,
      {
        width: 120,
      },
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor('#64748B')
    .text(
      'NIVEAU DE RISQUE',
      365,
      scoreY + 14,
    );

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(scoreColor)
    .text(
      source.summary.riskLevel,
      365,
      scoreY + 38,
      {
        width: 160,
      },
    );

  doc.y =
    scoreY + 92;

  doc.x =
    48;
        // --------------------------------------------------------------------
        // SEVERITY
        // --------------------------------------------------------------------

        sectionTitle(
          '2. Répartition des vulnérabilités',
        );

        this.pdfTable(
          doc,
          [
            'Sévérité',
            'Nombre',
          ],
          [
            [
              'CRITICAL',
              String(
                source.summary
                  .critical,
              ),
            ],
            [
              'HIGH',
              String(
                source.summary
                  .high,
              ),
            ],
            [
              'MEDIUM',
              String(
                source.summary
                  .medium,
              ),
            ],
            [
              'LOW',
              String(
                source.summary
                  .low,
              ),
            ],
            [
              'INFO',
              String(
                source.summary
                  .info,
              ),
            ],
          ],
        );

        doc.moveDown(1);

        doc.addPage();

        sectionTitle(
          'Statuts',
        );

        this.pdfObjectTable(
          doc,
          source.status,
        );

        sectionTitle(
          'Catégories',
        );

        this.pdfNamedTable(
          doc,
          source.categories,
        );

        sectionTitle(
          'OWASP',
        );

        this.pdfNamedTable(
          doc,
          source.owasp,
        );

        doc.addPage();

        sectionTitle(
          'CWE',
        );

        this.pdfNamedTable(
          doc,
          source.cwe,
        );

        doc.addPage();

        // --------------------------------------------------------------------
        // REPOSITORIES
        // --------------------------------------------------------------------

        sectionTitle(
          '3. Repositories',
        );

        this.pdfTable(
          doc,
          [
            'Repository',
            'Scans',
            'Findings',
            'Actifs',
            'Critical',
            'High',
            'Score',
          ],
          source.repositories.map(
            (repository) => [
              repository.name,
              String(
                repository.scans,
              ),
              String(
                repository.findings,
              ),
              String(
                repository.activeFindings,
              ),
              String(
                repository.critical,
              ),
              String(
                repository.high,
              ),
              repository.latestScore !==
              null
                ? String(
                    repository.latestScore,
                  )
                : 'N/A',
            ],
          ),
        );

        doc.moveDown(
          1,
        );


        // --------------------------------------------------------------------
        // SCANS
        // --------------------------------------------------------------------

        sectionTitle(
          source.report.scope ===
            ReportScope.SCAN
              ? '4. Scan analysé'
              : '4. Historique des scans',
        );

        this.pdfTable(
          doc,
          [
            'Date',
            'Repository',
            'Type',
            'Trigger',
            'Status',
            'Score',
          ],
          source.scans.map(
            (scan) => [
              this.formatDate(
                scan.createdAt,
              ),
              scan.repository,
              scan.type,
              scan.trigger,
              scan.status,
              scan.score !==
              null
                ? String(
                    scan.score,
                  )
                : 'N/A',
            ],
          ),
        );

        // --------------------------------------------------------------------
        // REMEDIATION
        // --------------------------------------------------------------------

        if (
          source.report.scope ===
          ReportScope.PROJECT
        ) {
          doc.addPage();

          sectionTitle(
            '5. Activité de remédiation',
          );

          this.pdfTable(
            doc,
            [
              'Date',
              'Finding',
              'Repository',
              'Acteur',
              'Transition',
            ],
            source.remediation.map(
              (item) => [
                this.formatDate(
                  item.date,
                ),
                item.findingTitle,
                item.repository,
                item.actor,
                `${item.previousStatus ?? '-'} → ${item.newStatus ?? '-'}`,
              ],
            ),
          );

          doc.addPage();

          sectionTitle(
            '6. Journal d’audit',
          );

          this.pdfTable(
            doc,
            [
              'Date',
              'Acteur',
              'Action',
              'Ressource',
              'Description',
            ],
            source.auditTrail.map(
              (item) => [
                this.formatDate(
                  item.date,
                ),
                item.actor,
                item.action,
                item.resourceType,
                item.description ??
                  '',
              ],
            ),
          );
        }

        // --------------------------------------------------------------------
        // FINDINGS
        // --------------------------------------------------------------------

        doc.addPage();

        sectionTitle(
          source.report.scope ===
            ReportScope.PROJECT
            ? '7. Findings'
            : '5. Findings',
        );

        if (
          source.findings.length ===
          0
        ) {
          doc
            .roundedRect(
              48,
              doc.y,
              width,
              55,
              7,
            )
            .fillAndStroke(
              '#F8FAFC',
              '#E2E8F0',
            );

          doc
            .font(
              'Helvetica-Bold',
            )
            .fontSize(
              11,
            )
            .fillColor(
              '#16A34A',
            )
            .text(
              'Aucune vulnérabilité détectée.',
              64,
              doc.y + 19,
            );
        } else {
          source.findings
            .slice(
              0,
              250,
            )
            .forEach(
              (
                finding,
                index,
              ) => {
                this.pdfFindingCard(
                  doc,
                  finding,
                  index,
                );
              },
            );
        }

        // --------------------------------------------------------------------
        // RECOMMENDATIONS
        // --------------------------------------------------------------------

        doc.addPage();

        sectionTitle(
          source.report.scope ===
            ReportScope.PROJECT
            ? '8. Recommandations'
            : '6. Recommandations',
        );

        source.recommendations.forEach(
          (
            recommendation,
            index,
          ) => {
            doc
              .fontSize(11)
              .font(
                'Helvetica-Bold',
              )
              .fillColor(
                '#172033',
              )
              .text(
                `${index + 1}.`,
                {
                  continued:
                    true,
                },
              );

            doc
              .font(
                'Helvetica',
              )
              .text(
                ` ${recommendation}`,
              );

            doc.moveDown(
              0.5,
            );
          },
        );

        sectionTitle(
          'Conclusion',
        );

        doc
          .fontSize(11)
          .font(
            'Helvetica',
          )
          .fillColor(
            '#172033',
          )
          .text(
            source.conclusion,
            {
              width,
            },
          );

        // --------------------------------------------------------------------
        // INTEGRITY
        // --------------------------------------------------------------------

        doc.moveDown(
          2,
        );

        sectionTitle(
          source.report.scope ===
            ReportScope.PROJECT
            ? '9. Intégrité du rapport'
            : '7. Intégrité du rapport',
        );

    doc
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#667085')
      .text(
        'L’empreinte SHA-256 définitive est calculée lors de la génération du fichier et enregistrée dans la fiche du rapport.',
        {
          width,
        },
      );

    const pageRange =
      doc.bufferedPageRange();

    const totalPages =
      pageRange.count;

    for (
      let pageIndex =
        pageRange.start;
      pageIndex <
      pageRange.start +
        pageRange.count;
      pageIndex++
    ) {
      doc.switchToPage(
        pageIndex,
      );

      const pageNumber =
        pageIndex -
        pageRange.start +
        1;

      if (
        pageNumber >
        1
      ) {
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#172033')
          .text(
            'SECURECODE',
            48,
            28,
            {
              width: 200,
              lineBreak: false,
            },
          );

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748B')
          .text(
            reportContextName,
            doc.page.width - 248,
            28,
            {
              width: 200,
              align: 'right',
              lineBreak: false,
            },
          );

        doc
          .strokeColor('#E2E8F0')
          .lineWidth(0.7)
          .moveTo(
            48,
            43,
          )
          .lineTo(
            doc.page.width - 48,
            43,
          )
          .stroke();
      }

      const footerY =
        doc.page.height -
        doc.page.margins.bottom -
        16;

      doc
        .strokeColor('#E2E8F0')
        .lineWidth(0.7)
        .moveTo(
          48,
          footerY - 8,
        )
        .lineTo(
          doc.page.width - 48,
          footerY - 8,
        )
        .stroke();

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor('#64748B')
        .text(
          'SecureCode - Rapport confidentiel',
          48,
          footerY,
          {
            width: 240,
            height: 10,
            lineBreak: false,
          },
        );

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#64748B')
      .text(
        `Page ${pageNumber} / ${totalPages}`,
        doc.page.width - 188,
        footerY,
        {
          width: 140,
          height: 10,
          align: 'right',
          lineBreak: false,
        },
      );
    }

    doc.end();
          },
        );
      }



  // ==========================================================================
  // HTML HELPERS
  // ==========================================================================

  private htmlCard(
    label: string,
    value:
      string | number,
  ) {
    return `
    <div class="card">
      <div class="card-label">
        ${this.escapeHtml(
          label,
        )}
      </div>
      <div class="card-value">
        ${this.escapeHtml(
          String(value),
        )}
      </div>
    </div>
    `;
  }

  private htmlSeverity(
    label: string,
    value: number,
  ) {
    return `
      <div class="severity">
        <strong>
          ${value}
        </strong>
        <span>
          ${label}
        </span>
      </div>
      `;
  }

  private htmlCountTable(
    values:
      Record<string, number>,
    label: string,
  ) {
    return `
      <table>
      <thead>
      <tr>
      <th>${this.escapeHtml(
            label,
          )}</th>
      <th>Nombre</th>
      </tr>
      </thead>
      <tbody>

      ${Object.entries(values)
        .map(
          ([key, value]) => `
      <tr>
      <td>${this.escapeHtml(
            key,
          )}</td>
      <td>${value}</td>
      </tr>
      `,
        )
        .join('')}

      </tbody>
      </table>
      `;
  }

  private htmlNamedTable(
    values: Array<{
      name: string;
      count: number;
    }>,
    label: string,
  ) {
    return `
    <table>
    <thead>
    <tr>
    <th>${this.escapeHtml(
          label,
        )}</th>
    <th>Nombre</th>
    </tr>
    </thead>
    <tbody>

    ${values
      .map(
        (item) => `
    <tr>
    <td>${this.escapeHtml(
          item.name,
        )}</td>
    <td>${item.count}</td>
    </tr>
    `,
      )
      .join('')}

    </tbody>
    </table>
    `;
  }

  private htmlRepositories(
    source: ReportSource,
  ) {
    return `
    <table>
    <thead>
    <tr>
    <th>Repository</th>
    <th>Scans</th>
    <th>Findings</th>
    <th>Actifs</th>
    <th>Critical</th>
    <th>High</th>
    <th>Score</th>
    </tr>
    </thead>
    <tbody>

    ${source.repositories
      .map(
        (repository) => `
    <tr>
    <td>
    <strong>${this.escapeHtml(
          repository.name,
        )}</strong>
    <br>
    <span class="muted">
    ${this.escapeHtml(
      repository.fullName,
    )}
    </span>
    </td>

    <td>${repository.scans}</td>
    <td>${repository.findings}</td>
    <td>${repository.activeFindings}</td>
    <td>${repository.critical}</td>
    <td>${repository.high}</td>
    <td>
    ${
      repository.latestScore ??
      'N/A'
    }
    </td>
    </tr>
    `,
      )
      .join('')}

    </tbody>
    </table>
    `;
  }

  private htmlScans(
    source: ReportSource,
  ) {
  return `
    <table>
    <thead>
    <tr>
    <th>Date</th>
    <th>Repository</th>
    <th>Type</th>
    <th>Trigger</th>
    <th>Status</th>
    <th>Score</th>
    </tr>
    </thead>

    <tbody>

    ${source.scans
      .map(
        (scan) => `
    <tr>
    <td>
    ${this.formatDate(
      scan.createdAt,
    )}
    </td>

    <td>
    ${this.escapeHtml(
      scan.repository,
    )}
    </td>

    <td>
    <span class="badge">
    ${this.escapeHtml(
      scan.type,
    )}
    </span>
    </td>

    <td>
    ${this.escapeHtml(
      scan.trigger,
    )}
    </td>

    <td>
    ${this.escapeHtml(
      scan.status,
    )}
    </td>

    <td>
    ${
      scan.score ??
      'N/A'
    }
    </td>

    </tr>
    `,
      )
      .join('')}

    </tbody>
    </table>
    `;
  }

  private htmlFindings(
    source: ReportSource,
  ) {
    if (
      !source.findings.length
    ) {
    return `
      <p class="muted">
      Aucun finding trouvé dans le périmètre du rapport.
      </p>
      `;
    }

    return source.findings
      .slice(0, 250)
      .map(
        (finding) => `
    <div class="finding">

    <div class="finding-header">

    <div class="finding-title">
    ${this.escapeHtml(
      finding.title,
    )}
    </div>

    <span class="badge">
    ${this.escapeHtml(
      finding.severity,
    )}
    </span>

    <span class="badge">
    ${this.escapeHtml(
      finding.status,
    )}
    </span>

    </div>

    <div class="finding-body">

    <div class="finding-grid">

    <div>
    <div class="label">
    Repository
    </div>

    <div class="value">
    ${this.escapeHtml(
      finding.repository,
    )}
    </div>
    </div>

    <div>
    <div class="label">
    Scanner
    </div>

    <div class="value">
    ${this.escapeHtml(
      finding.scanner,
    )}
    </div>
    </div>

    <div>
    <div class="label">
    Rule
    </div>

    <div class="value">
    ${this.escapeHtml(
      finding.ruleId,
    )}
    </div>
    </div>

    <div>
    <div class="label">
    CWE
    </div>

    <div class="value">
    ${this.escapeHtml(
      finding.cweId ??
        'N/A',
    )}
    </div>
    </div>

    <div>
    <div class="label">
    OWASP
    </div>

    <div class="value">
    ${this.escapeHtml(
      finding.owaspCategory ??
        'N/A',
    )}
    </div>
    </div>

    <div>
    <div class="label">
    CVSS
    </div>

    <div class="value">
    ${
      finding.cvssScore ??
      'N/A'
    }
    </div>
    </div>

    <div>
    <div class="label">
    Fichier
    </div>

    <div class="value">
    ${this.escapeHtml(
      finding.filePath ??
        'N/A',
    )}
    </div>
    </div>

    <div>
    <div class="label">
    Ligne
    </div>

    <div class="value">
    ${
      finding.startLine ??
      'N/A'
    }
    </div>
    </div>

    </div>

    ${
      finding.recommendation
        ? `
    <div class="recommendation">
    <strong>
    Recommandation
    </strong>
    <br>
    ${this.escapeHtml(
      finding.recommendation,
    )}
    </div>
    `
        : ''
    }

    </div>

    </div>
    `,
      )
      .join('');
  }

  private htmlRemediation(
    source: ReportSource,
  ) {
    if (
      !source.remediation.length
      ) {
        return `
          <p class="muted">
          Aucune modification de statut de finding
          n'a été enregistrée sur la période.
          </p>
          `;
      }

      return `
      <table>
      <thead>
      <tr>
      <th>Date</th>
      <th>Finding</th>
      <th>Repository</th>
      <th>Acteur</th>
      <th>Transition</th>
      <th>Commentaire</th>
      </tr>
      </thead>

      <tbody>

      ${source.remediation
        .map(
          (item) => `
      <tr>
      <td>
      ${this.formatDate(
        item.date,
      )}
      </td>

      <td>
      ${this.escapeHtml(
        item.findingTitle,
      )}
      </td>

      <td>
      ${this.escapeHtml(
        item.repository,
      )}
      </td>

      <td>
      ${this.escapeHtml(
        item.actor,
      )}
      </td>

      <td>
      ${this.escapeHtml(
        `${item.previousStatus ?? '-'} → ${item.newStatus ?? '-'}`,
      )}
      </td>

      <td>
      ${this.escapeHtml(
        item.comment ??
          '',
      )}
      </td>

      </tr>
      `,
        )
        .join('')}

      </tbody>
      </table>
      `;
  }

  private htmlAudit(
    source: ReportSource,
  ) {
    if (
      !source.auditTrail.length
    ) {
      return `
        <p class="muted">
        Aucune activité d'audit sur la période.
        </p>
        `;
    }

    return `
      <table>
      <thead>
      <tr>
      <th>Date</th>
      <th>Acteur</th>
      <th>Action</th>
      <th>Ressource</th>
      <th>Description</th>
      </tr>
      </thead>

      <tbody>

      ${source.auditTrail
        .map(
          (item) => `
      <tr>
      <td>
      ${this.formatDate(
        item.date,
      )}
      </td>

      <td>
      ${this.escapeHtml(
        item.actor,
      )}
      </td>

      <td>
      ${this.escapeHtml(
        item.action,
      )}
      </td>

      <td>
      ${this.escapeHtml(
        item.resourceType,
      )}
      </td>

      <td>
      ${this.escapeHtml(
        item.description ??
          '',
      )}
      </td>

      </tr>
      `,
        )
        .join('')}

      </tbody>
      </table>
      `;
  }

  // ==========================================================================
  // PDF HELPERS
  // ==========================================================================

  private pdfTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
  ) {
    const left =
      48;

    const availableWidth =
      doc.page.width -
      96;

    const columnWidth =
      availableWidth /
      headers.length;

    const bottomLimit =
      doc.page.height -
      doc.page.margins.bottom -
      20;

    let y =
      doc.y;

    const drawHeader =
      () => {
        headers.forEach(
          (
            header,
            index,
          ) => {
            const x =
              left +
              index *
                columnWidth;

            doc
              .rect(
                x,
                y,
                columnWidth,
                28,
              )
              .fill(
                '#172033',
              );

            doc
              .font(
                'Helvetica-Bold',
              )
              .fontSize(
                7.5,
              )
              .fillColor(
                '#FFFFFF',
              )
              .text(
                header.toUpperCase(),
                x + 7,
                y + 9,
                {
                  width:
                    columnWidth -
                    14,

                  ellipsis:
                    true,
                },
              );
          },
        );

        y += 28;
      };

    drawHeader();

    if (
      rows.length ===
      0
    ) {
      doc
        .rect(
          left,
          y,
          availableWidth,
          38,
        )
        .fillAndStroke(
          '#F8FAFC',
          '#E2E8F0',
        );

      doc
        .font(
          'Helvetica-Oblique',
        )
        .fontSize(
          9,
        )
        .fillColor(
          '#64748B',
        )
        .text(
          'Aucune donnée disponible.',
          left + 10,
          y + 13,
        );

      doc.y =
        y + 48;

      doc.x =
        left;

      return;
    }

    rows.forEach(
      (
        row,
        rowIndex,
      ) => {
        const cellHeights =
          row.map(
            cell =>
              doc
                .font(
                  'Helvetica',
                )
                .fontSize(
                  8,
                )
                .heightOfString(
                  cell ||
                    'N/A',
                  {
                    width:
                      columnWidth -
                      14,
                  },
                ),
          );

        const rowHeight =
          Math.max(
            32,
            ...cellHeights.map(
              height =>
                height + 16,
            ),
          );

        if (
          y + rowHeight >
          bottomLimit
        ) {
          doc.addPage();

          y =
            doc.page.margins.top;

          drawHeader();
        }

        const backgroundColor =
          rowIndex %
            2 ===
          0
            ? '#FFFFFF'
            : '#F8FAFC';

        row.forEach(
          (
            cell,
            index,
          ) => {
            const x =
              left +
              index *
                columnWidth;

            doc
              .rect(
                x,
                y,
                columnWidth,
                rowHeight,
              )
              .fillAndStroke(
                backgroundColor,
                '#E2E8F0',
              );

            doc
              .font(
                'Helvetica',
              )
              .fontSize(
                8,
              )
              .fillColor(
                '#334155',
              )
              .text(
                cell ||
                  'N/A',
                x + 7,
                y + 8,
                {
                  width:
                    columnWidth -
                    14,

                  height:
                    rowHeight -
                    12,

                  ellipsis:
                    true,
                },
              );
          },
        );

        y +=
          rowHeight;
      },
    );

    doc.y =
      y + 14;

    doc.x =
      left;
  }

  private pdfSeverityColor(
    severity: string,
  ): string {
    switch (
      severity.toUpperCase()
    ) {
      case 'CRITICAL':
        return '#DC2626';

      case 'HIGH':
        return '#EA580C';

      case 'MEDIUM':
        return '#CA8A04';

      case 'LOW':
        return '#2563EB';

      default:
        return '#64748B';
    }
  }

  private pdfFindingCard(
  doc: PDFKit.PDFDocument,
  finding: ReportSource['findings'][number],
  index: number,
) {
  const left =
    48;

  const width =
    doc.page.width -
    96;

  const recommendation =
    finding.recommendation ||
    'Aucune recommandation disponible.';

  const recommendationHeight =
    doc
      .font(
        'Helvetica',
      )
      .fontSize(
        9,
      )
      .heightOfString(
        recommendation,
        {
          width:
            width - 36,
        },
      );

  const cardHeight =
    Math.max(
      190,
      172 +
        recommendationHeight,
    );

  const bottomLimit =
    doc.page.height -
    doc.page.margins.bottom -
    20;

  if (
    doc.y + cardHeight >
    bottomLimit
  ) {
    doc.addPage();
  }

  const y =
    doc.y;

  const severityColor =
    this.pdfSeverityColor(
      finding.severity,
    );

  doc
    .roundedRect(
      left,
      y,
      width,
      cardHeight,
      8,
    )
    .fillAndStroke(
      '#FFFFFF',
      '#E2E8F0',
    );

  doc
    .roundedRect(
      left,
      y,
      6,
      cardHeight,
      3,
    )
    .fill(
      severityColor,
    );

  doc
    .font(
      'Helvetica-Bold',
    )
    .fontSize(
      12,
    )
    .fillColor(
      '#0F172A',
    )
    .text(
      `${index + 1}. ${finding.title}`,
      left + 18,
      y + 14,
      {
        width:
          width - 140,
      },
    );

  const badgeWidth =
    82;

  doc
    .roundedRect(
      left +
        width -
        badgeWidth -
        14,
      y + 12,
      badgeWidth,
      22,
      11,
    )
    .fill(
      severityColor,
    );

  doc
    .font(
      'Helvetica-Bold',
    )
    .fontSize(
      8,
    )
    .fillColor(
      '#FFFFFF',
    )
    .text(
      finding.severity,
      left +
        width -
        badgeWidth -
        14,
      y + 19,
      {
        width:
          badgeWidth,

        align:
          'center',
      },
    );

  const firstColumn =
    left + 18;

  const secondColumn =
    left + 185;

  const thirdColumn =
    left + 350;

  this.pdfFindingMetadata(
    doc,
    'Repository',
    finding.repository,
    firstColumn,
    y + 52,
    145,
  );

  this.pdfFindingMetadata(
    doc,
    'Statut',
    finding.status,
    secondColumn,
    y + 52,
    145,
  );

  this.pdfFindingMetadata(
    doc,
    'Score CVSS',
    finding.cvssScore !==
    null
      ? String(
          finding.cvssScore,
        )
      : 'N/A',
    thirdColumn,
    y + 52,
    120,
  );

  this.pdfFindingMetadata(
    doc,
    'Règle',
    finding.ruleId,
    firstColumn,
    y + 86,
    145,
  );

  this.pdfFindingMetadata(
    doc,
    'CWE',
    finding.cweId ??
      'N/A',
    secondColumn,
    y + 86,
    145,
  );

  this.pdfFindingMetadata(
    doc,
    'OWASP',
    finding.owaspCategory ??
      'N/A',
    thirdColumn,
    y + 86,
    120,
  );

  this.pdfFindingMetadata(
    doc,
    'Fichier',
    finding.filePath
      ? finding.startLine
        ? `${finding.filePath}:${finding.startLine}`
        : finding.filePath
      : 'N/A',
    firstColumn,
    y + 120,
    width - 36,
  );

  const recommendationY =
    y + 153;

  doc
    .roundedRect(
      left + 18,
      recommendationY,
      width - 36,
      recommendationHeight + 24,
      5,
    )
    .fill(
      '#F1F5F9',
    );

  doc
    .font(
      'Helvetica-Bold',
    )
    .fontSize(
      7,
    )
    .fillColor(
      '#2563EB',
    )
    .text(
      'RECOMMANDATION',
      left + 28,
      recommendationY + 7,
    );

  doc
    .font(
      'Helvetica',
    )
    .fontSize(
      9,
    )
    .fillColor(
      '#334155',
    )
    .text(
      recommendation,
      left + 28,
      recommendationY + 18,
      {
        width:
          width - 56,
      },
    );

  doc.y =
    y +
    cardHeight +
    12;

  doc.x =
    left;
}

  private pdfFindingMetadata(
    doc: PDFKit.PDFDocument,
    label: string,
    value: string,
    x: number,
    y: number,
    width: number,
  ) {
    doc
      .font(
        'Helvetica-Bold',
      )
      .fontSize(
        7,
      )
      .fillColor(
        '#64748B',
      )
      .text(
        label.toUpperCase(),
        x,
        y,
        {
          width,
        },
      );

    doc
      .font(
        'Helvetica',
      )
      .fontSize(
        8.5,
      )
      .fillColor(
        '#172033',
      )
      .text(
        value ||
          'N/A',
        x,
        y + 12,
        {
          width,

          ellipsis:
            true,
        },
      );
  }

  private pdfObjectTable(
    doc: PDFKit.PDFDocument,
    values:
      Record<string, number>,
  ) {
    this.pdfTable(
      doc,
      [
        'Élément',
        'Nombre',
      ],
      Object.entries(
        values,
      ).map(
        ([key, value]) => [
          key,
          String(value),
        ],
      ),
    );
  }

  private pdfNamedTable(
    doc: PDFKit.PDFDocument,
    values: Array<{
      name: string;
      count: number;
    }>,
  ) {
    this.pdfTable(
      doc,
      [
        'Catégorie',
        'Nombre',
      ],
      values.map(
        (item) => [
          item.name,
          String(
            item.count,
          ),
        ],
      ),
    );
  }

  // ==========================================================================
  // UTILS
  // ==========================================================================

  private parseFilters(
    value:
      Prisma.JsonValue | null,
  ): ReportFilters {
    if (
      !value ||
      typeof value !==
        'object' ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as ReportFilters;
  }

  private resolveScope(
    filters: ReportFilters,
    scanId:
      string | null,
  ): ReportScope {
    if (
      filters.scope ===
      ReportScope.ORGANIZATION
    ) {
      return ReportScope.ORGANIZATION;
    }

    if (
      filters.scope ===
      ReportScope.PROJECT
    ) {
      return ReportScope.PROJECT;
    }

    if (
      filters.scope ===
      ReportScope.REPOSITORY
    ) {
      return ReportScope.REPOSITORY;
    }

    if (
      filters.scope ===
      ReportScope.SCAN
    ) {
      return ReportScope.SCAN;
    }

    return scanId
      ? ReportScope.SCAN
      : ReportScope.REPOSITORY;
  }

  private countBy<T>(
    items: T[],
    selector: (
      item: T,
    ) => string,
  ): Record<string, number> {
    const result:
      Record<string, number> =
      {};

    for (
      const item of items
    ) {
      const key =
        selector(item);

      result[key] =
        (result[key] ?? 0) +
        1;
    }

    return result;
  }

  private countNamed<T>(
    items: T[],
    selector: (
      item: T,
    ) => string | null | undefined,
  ) {
    const counts =
      new Map<
        string,
        number
      >();

    for (
      const item of items
    ) {
      const value =
        selector(item);

      if (!value) {
        continue;
      }

      counts.set(
        value,
        (counts.get(
          value,
        ) ?? 0) + 1,
      );
    }

    return Array.from(
      counts.entries(),
    )
      .map(
        ([
          name,
          count,
        ]) => ({
          name,
          count,
        }),
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.count -
          a.count,
      );
  }

  private isResolvedStatus(
    status: FindingStatus,
  ): boolean {
    return this.resolvedStatuses.has(
      status,
    );
  }

  private calculateRiskLevel(
    critical: number,
    high: number,
    medium: number,
    active: number,
  ) {
    if (
      critical > 0
    ) {
      return 'CRITIQUE';
    }

    if (
      high > 0
    ) {
      return 'ÉLEVÉ';
    }

    if (
      medium > 0
    ) {
      return 'MODÉRÉ';
    }

    if (
      active > 0
    ) {
      return 'FAIBLE';
    }

    return 'MAÎTRISÉ';
  }

  private displayUser(
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    },
  ) {
    const name =
      [
        user.firstName,
        user.lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

    return (
      name ||
      user.email ||
      'Utilisateur'
    );
  }

  private asObject(
    value:
      Prisma.JsonValue | null,
  ): Record<
    string,
    unknown
  > {
    if (
      value &&
      typeof value ===
        'object' &&
      !Array.isArray(value)
    ) {
      return value as Record<
        string,
        unknown
      >;
    }

    return {};
  }

  private stringValue(
    value: unknown,
  ): string | null {
    return typeof value ===
      'string'
      ? value
      : null;
  }

  private round(
    value: number,
    decimals: number,
  ) {
    const factor =
      Math.pow(
        10,
        decimals,
      );

    return (
      Math.round(
        value * factor,
      ) / factor
    );
  }

  private addDays(
    date: Date,
    days: number,
  ) {
    const result =
      new Date(date);

    result.setDate(
      result.getDate() +
        days,
    );

    return result;
  }

  private endOfDay(
    date: Date,
  ): Date {
    const result =
      new Date(date);

    result.setUTCHours(
      23,
      59,
      59,
      999,
    );

    return result;
  }

  private formatDate(
    value:
      string | Date,
  ) {
    const date =
      value instanceof Date
        ? value
        : new Date(value);

    return new Intl.DateTimeFormat(
      'fr-FR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    ).format(date);
  }

  private formatDateForName(
    value: Date,
  ) {
    return new Intl.DateTimeFormat(
      'fr-FR',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      },
    )
      .format(value)
      .replace(
        /\//g,
        '-',
      );
  }

  private escapeHtml(
    value: string,
  ) {
    return String(value)
      .replace(
        /&/g,
        '&amp;',
      )
      .replace(
        /</g,
        '&lt;',
      )
      .replace(
        />/g,
        '&gt;',
      )
      .replace(
        /"/g,
        '&quot;',
      )
      .replace(
        /'/g,
        '&#039;',
      );
  }

  private truncate(
    value: string,
    max: number,
  ) {
    if (
      value.length <=
      max
    ) {
      return value;
    }

    return (
      value.substring(
        0,
        max - 3,
      ) + '...'
    );
  }

  private calculateWstgScore(
  findings: Array<{
    severity: string;
    owaspCategory?: string | null;
  }>,
): number {
  const penalty = {
    CRITICAL: 25,
    HIGH: 12,
    MEDIUM: 5,
    LOW: 2,
    INFO: 0.25,
  } as const;

  const categories = new Map<
    string,
    {
      total: number;
      penalty: number;
    }
  >();

  for (const finding of findings) {
    const wstg = finding.owaspCategory
      ? this.mapOwaspToWstg(
          finding.owaspCategory,
        )
      : 'WSTG-OTHER';

    const current =
      categories.get(wstg) ?? {
        total: 0,
        penalty: 0,
      };

    current.total += 1;

    const severity =
      finding.severity as keyof typeof penalty;

    current.penalty +=
      penalty[severity] ?? 0;

    categories.set(wstg, current);
  }

  if (categories.size === 0) {
    return 100;
  }

  const scores = [
    ...categories.values(),
  ].map((category) =>
    Math.max(
      0,
      100 - category.penalty,
    ),
  );

  return Number(
    (
      scores.reduce(
        (sum, score) =>
          sum + score,
        0,
      ) / scores.length
    ).toFixed(2),
  );
}

  private mapOwaspToWstg(
    owaspCategory: string,
  ): string {
    const normalized =
      owaspCategory
        .trim()
        .toUpperCase();

    if (
      this.OWASP_TO_WSTG[
        normalized
      ]
    ) {
      return this.OWASP_TO_WSTG[
        normalized
      ];
    }

    const match =
      normalized.match(
        /A(0?[1-9]|10)/,
      );

    if (!match) {
      return 'WSTG-OTHER';
    }

    const code =
      `A${match[1].padStart(2, '0')}`;

    return (
      this.OWASP_TO_WSTG[code] ??
      'WSTG-OTHER'
    );
  }

  private buildWstgBreakdown(
    findings: Array<{
      severity: string;
      owaspCategory?: string | null;
    }>,
  ) {
    const penalty = {
      CRITICAL: 25,
      HIGH: 12,
      MEDIUM: 5,
      LOW: 2,
      INFO: 0.25,
    } as const;

    const categories = new Map<
      string,
      {
        findings: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
        penalty: number;
      }
    >();

    for (const finding of findings) {
      const wstg = finding.owaspCategory
        ? this.mapOwaspToWstg(
            finding.owaspCategory,
          )
        : 'WSTG-OTHER';

      const current =
        categories.get(wstg) ?? {
          findings: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          info: 0,
          penalty: 0,
        };

      current.findings += 1;

      switch (finding.severity) {
        case 'CRITICAL':
          current.critical += 1;
          break;

        case 'HIGH':
          current.high += 1;
          break;

        case 'MEDIUM':
          current.medium += 1;
          break;

        case 'LOW':
          current.low += 1;
          break;

        case 'INFO':
          current.info += 1;
          break;
      }

      const severity =
        finding.severity as keyof typeof penalty;

      current.penalty +=
        penalty[severity] ?? 0;

      categories.set(
        wstg,
        current,
      );
    }

    return [...categories.entries()]
      .map(([code, value]) => {
        const score =
          Math.max(
            0,
            100 - value.penalty,
          );

        return {
          code,
          name:
            this.getWstgName(code),

          findings:
            value.findings,

          critical:
            value.critical,

          high:
            value.high,

          medium:
            value.medium,

          low:
            value.low,

          info:
            value.info,

          score:
            Number(
              score.toFixed(2),
            ),

          grade:
            this.getWstgGrade(score),
        };
      })
      .sort(
        (a, b) =>
          b.findings -
          a.findings,
      );
  }

  private getWstgName(
    code: string,
  ): string {
    const names: Record<
      string,
      string
    > = {
      'WSTG-ATHZ':
        'Authorization Testing',

      'WSTG-CRYP':
        'Cryptography',

      'WSTG-INPV':
        'Input Validation',

      'WSTG-BUSL':
        'Business Logic Testing',

      'WSTG-CONF':
        'Configuration and Deployment',

      'WSTG-ATHN':
        'Authentication Testing',

      'WSTG-ERRH':
        'Error Handling',

      'WSTG-OTHER':
        'Other Security Tests',
    };

    return (
      names[code] ??
      code
    );
  }

  private getWstgGrade(
    score: number,
  ): string {
    if (score >= 90) {
      return 'A';
    }

    if (score >= 80) {
      return 'B';
    }

    if (score >= 70) {
      return 'C';
    }

    if (score >= 60) {
      return 'D';
    }

    return 'F';
  }

  private parseReportPeriod(
    fromDate?: string,
    toDate?: string,
  ) {
    if (
      !fromDate ||
      !toDate
    ) {
      throw new BadRequestException(
        'fromDate et toDate sont obligatoires pour ce type de rapport.',
      );
    }

    const from =
      new Date(
        fromDate,
      );

    const to =
      new Date(
        toDate,
      );

    if (
      Number.isNaN(
        from.getTime(),
      ) ||
      Number.isNaN(
        to.getTime(),
      )
    ) {
      throw new BadRequestException(
        'Période de rapport invalide.',
      );
    }

    if (
      from.getTime() >
      to.getTime()
    ) {
      throw new BadRequestException(
        'La date de début doit être antérieure à la date de fin.',
      );
    }

    return {
      fromDate:
        from,

      toDate:
        to,
    };
  }

  private async ensureOrganizationAccess(
    organizationId: string,
    userId: string,
  ) {
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

    const membership =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },

        include: {
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

    if (!membership) {
      throw new NotFoundException(
        "Accès à l'organisation refusé.",
      );
    }

    if (
      membership.role.scope !==
      'ORGANIZATION'
    ) {
      throw new NotFoundException(
        "Rôle organisation invalide.",
      );
    }

    return {
      organization,
      membership,
    };
  }

  async createOrganizationReport(
    organizationId: string,
    userId: string,
    dto: CreateReportDto,
  ) {
    const {
      organization,
    } =
      await this.ensureOrganizationAccess(
        organizationId,
        userId,
      );

    const {
      fromDate,
      toDate,
    } =
      this.parseReportPeriod(
        dto.fromDate,
        dto.toDate,
      );

    /*
    |--------------------------------------------------------------------------
    | Vérifier qu'il existe au moins un projet
    |--------------------------------------------------------------------------
    */

    const projectsCount =
      await this.prisma.project.count({
        where: {
          organizationId,
        },
      });

    if (
      projectsCount ===
      0
    ) {
      throw new BadRequestException(
        "L'organisation ne contient aucun projet.",
      );
    }

    const filters:
      JsonObject = {
      scope:
        ReportScope.ORGANIZATION,

      fromDate:
        fromDate.toISOString(),

      toDate:
        toDate.toISOString(),
    };

    const report =
      await this.prisma.report.create({
        data: {
          organizationId,

          projectId:
            null,

          scanId:
            null,

          requestedById:
            userId,

          status:
            ReportStatus.READY,

          format:
            dto.format,

          name:
            `Organisation - ${organization.name} - ${this.formatDateForName(fromDate)} - ${this.formatDateForName(toDate)}`,

          filters:
            filters as Prisma.InputJsonValue,

          generatedAt:
            new Date(),

          expiresAt:
            this.addDays(
              new Date(),
              30,
            ),
        },

        select: {
          id:
            true,

          organizationId:
            true,

          projectId:
            true,

          scanId:
            true,

          format:
            true,

          status:
            true,

          name:
            true,

          filters:
            true,

          generatedAt:
            true,

          expiresAt:
            true,

          createdAt:
            true,
        },
      });

    await this.prisma.auditLog.create({
      data: {
        organizationId,

        projectId:
          null,

        actorId:
          userId,

        action:
          AuditAction.EXPORT,

        resourceType:
          'OrganizationReport',

        resourceId:
          report.id,

        description:
          `Rapport organisation créé pour ${organization.name}.`,

        metadata: {
          scope:
            ReportScope.ORGANIZATION,

          format:
            dto.format,

          fromDate:
            fromDate.toISOString(),

          toDate:
            toDate.toISOString(),

          projectsCount,
        },
      },
    });

    try {
      await this.notifications.create({
        userId,

        type:
          'REPORT_READY',

        title:
          'Rapport organisation prêt',

        message:
          `Le rapport de ${organization.name} est prêt.`,

        metadata: {
          reportId:
            report.id,

          organizationId,

          scope:
            ReportScope.ORGANIZATION,

          fromDate:
            fromDate.toISOString(),

          toDate:
            toDate.toISOString(),
        },
      });
    } catch {
      // Ne pas faire échouer le rapport
      // pour une notification.
    }

    return {
      ...report,

      scope:
        ReportScope.ORGANIZATION,
    };
  }

  async listOrganizationReports(
    organizationId: string,
    userId: string,
  ) {
    await this.ensureOrganizationAccess(
      organizationId,
      userId,
    );

    const reports =
      await this.prisma.report.findMany({
        where: {
          organizationId,

          projectId:
            null,

          filters: {
            path: [
              'scope',
            ],

            equals:
              ReportScope.ORGANIZATION,
          },
        },

        orderBy: {
          createdAt:
            'desc',
        },

        include: {
          requestedBy: {
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

    return reports.map(
      (
        report,
      ) => {
        const filters =
          this.parseFilters(
            report.filters,
          );

        return {
          id:
            report.id,

          organizationId:
            report.organizationId,

          projectId:
            null,

          scanId:
            null,

          status:
            report.status,

          format:
            report.format,

          name:
            report.name,

          scope:
            ReportScope.ORGANIZATION,

          fromDate:
            filters.fromDate ??
            null,

          toDate:
            filters.toDate ??
            null,

          fileSize:
            report.fileSize
              ? Number(
                  report.fileSize,
                )
              : null,

          checksum:
            report.checksum,

          generatedAt:
            report.generatedAt,

          expiresAt:
            report.expiresAt,

          createdAt:
            report.createdAt,

          requestedBy:
            report.requestedBy,
        };
      },
    );
  }

  private async buildOrganizationSource(
    organizationId: string,

    report: {
      id: string;
      name: string;
      format: ReportFormat;
      filters:
        Prisma.JsonValue | null;
      generatedAt:
        Date | null;
    },
  ): Promise<OrganizationReportSource> {
    const filters =
      this.parseFilters(
        report.filters,
      );

    const period =
      this.parseReportPeriod(
        filters.fromDate,
        filters.toDate,
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

    /*
    |--------------------------------------------------------------------------
    | IMPORTANT
    |--------------------------------------------------------------------------
    |
    | Toutes les requêtes restent filtrées par organizationId.
    |
    | Aucun repository / scan / finding provenant d'un autre tenant
    | ne peut entrer dans ce rapport.
    |
    */

    const projects =
      await this.prisma.project.findMany({
        where: {
          organizationId,
        },

        orderBy: {
          name:
            'asc',
        },

        select: {
          id:
            true,

          name:
            true,

          slug:
            true,

          status:
            true,

          repositories: {
            where: {
              organizationId,
            },

            select: {
              id:
                true,
            },
          },

          scans: {
            where: {
              createdAt: {
                gte:
                  period.fromDate,

                lte:
                  period.toDate,
              },

              repository: {
                organizationId,
              },
            },

            select: {
              id:
                true,

              status:
                true,

              score:
                true,
            },
          },

          findings: {
            where: {
              repository: {
                organizationId,
              },

              lastDetectedAt: {
                gte:
                  period.fromDate,

                lte:
                  period.toDate,
              },
            },

            select: {
              id:
                true,

              severity:
                true,

              status:
                true,
            },
          },
        },
      });

    const projectSummaries:
      OrganizationReportProjectSummary[] =
      projects.map(
        (
          project,
        ) => {
          const findings =
            project.findings;

          const scans =
            project.scans;

          const completedScans =
            scans.filter(
              (
                scan,
              ) =>
                scan.status ===
                'COMPLETED',
            ).length;

          const failedScans =
            scans.filter(
              (
                scan,
              ) =>
                scan.status ===
                'FAILED',
            ).length;

          const activeFindings =
            findings.filter(
              (
                finding,
              ) =>
                !this.isResolvedStatus(
                  finding.status,
                ),
            ).length;

          const resolvedFindings =
            findings.length -
            activeFindings;

          const critical =
            findings.filter(
              (
                finding,
              ) =>
                finding.severity ===
                FindingSeverity.CRITICAL,
            ).length;

          const high =
            findings.filter(
              (
                finding,
              ) =>
                finding.severity ===
                FindingSeverity.HIGH,
            ).length;

          const medium =
            findings.filter(
              (
                finding,
              ) =>
                finding.severity ===
                FindingSeverity.MEDIUM,
            ).length;

          const low =
            findings.filter(
              (
                finding,
              ) =>
                finding.severity ===
                FindingSeverity.LOW,
            ).length;

          const info =
            findings.filter(
              (
                finding,
              ) =>
                finding.severity ===
                FindingSeverity.INFO,
            ).length;

          const scores =
            scans
              .map(
                (
                  scan,
                ) =>
                  scan.score ===
                  null
                    ? null
                    : Number(
                        scan.score,
                      ),
              )
              .filter(
                (
                  score,
                ): score is number =>
                  score !==
                  null,
              );

          const averageScore =
            scores.length >
            0
              ? this.round(
                  scores.reduce(
                    (
                      total,
                      score,
                    ) =>
                      total +
                      score,
                    0,
                  ) /
                    scores.length,

                  2,
                )
              : null;

          const remediationRate =
            findings.length >
            0
              ? this.round(
                  (
                    resolvedFindings /
                    findings.length
                  ) *
                    100,

                  2,
                )
              : 0;

          return {
            id:
              project.id,

            name:
              project.name,

            slug:
              project.slug,

            status:
              String(
                project.status,
              ),

            repositories:
              project.repositories
                .length,

            scans:
              scans.length,

            completedScans,

            failedScans,

            findings:
              findings.length,

            activeFindings,

            resolvedFindings,

            critical,

            high,

            medium,

            low,

            info,

            averageScore,

            remediationRate,

            riskLevel:
              this.calculateRiskLevel(
                critical,
                high,
                medium,
                activeFindings,
              ),
          };
        },
      );

    /*
    |--------------------------------------------------------------------------
    | Agrégation globale organisation
    |--------------------------------------------------------------------------
    */

    const repositories =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.repositories,
        0,
      );

    const scans =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.scans,
        0,
      );

    const completedScans =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.completedScans,
        0,
      );

    const failedScans =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.failedScans,
        0,
      );

    const findings =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.findings,
        0,
      );

    const activeFindings =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.activeFindings,
        0,
      );

    const resolvedFindings =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.resolvedFindings,
        0,
      );

    const critical =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.critical,
        0,
      );

    const high =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.high,
        0,
      );

    const medium =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.medium,
        0,
      );

    const low =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.low,
        0,
      );

    const info =
      projectSummaries.reduce(
        (
          total,
          project,
        ) =>
          total +
          project.info,
        0,
      );

    const projectScores =
      projectSummaries
        .map(
          (
            project,
          ) =>
            project.averageScore,
        )
        .filter(
          (
            score,
          ): score is number =>
            score !==
            null,
        );

    const averageScore =
      projectScores.length >
      0
        ? this.round(
            projectScores.reduce(
              (
                total,
                score,
              ) =>
                total +
                score,
              0,
            ) /
              projectScores.length,

            2,
          )
        : null;

    const remediationRate =
      findings >
      0
        ? this.round(
            (
              resolvedFindings /
              findings
            ) *
              100,

            2,
          )
        : 0;

    return {
      report: {
        id:
          report.id,

        name:
          report.name,

        format:
          report.format,

        scope:
          ReportScope.ORGANIZATION,

        generatedAt:
          (
            report.generatedAt ??
            new Date()
          ).toISOString(),
      },

      organization,

      period: {
        from:
          period.fromDate
            .toISOString(),

        to:
          period.toDate
            .toISOString(),
      },

      summary: {
        projects:
          projectSummaries.length,

        repositories,

        scans,

        completedScans,

        failedScans,

        findings,

        activeFindings,

        resolvedFindings,

        critical,

        high,

        medium,

        low,

        info,

        averageScore,

        remediationRate,

        riskLevel:
          this.calculateRiskLevel(
            critical,
            high,
            medium,
            activeFindings,
          ),
      },

      projects:
        projectSummaries,
    };
  }

  private renderOrganizationHtml(
    source:
      OrganizationReportSource,
  ): string {
    const summary =
      source.summary;

    const period =
      `${this.formatDate(
        source.period.from,
      )} — ${this.formatDate(
        source.period.to,
      )}`;

    const projectRows =
      source.projects
        .map(
          (
            project,
          ) => `
  <tr>
    <td>
      ${this.escapeHtml(
        project.name,
      )}
    </td>

    <td>
      ${project.repositories}
    </td>

    <td>
      ${project.scans}
    </td>

    <td>
      ${project.findings}
    </td>

    <td>
      ${project.activeFindings}
    </td>

    <td class="critical">
      ${project.critical}
    </td>

    <td class="high">
      ${project.high}
    </td>

    <td>
      ${
        project.averageScore ??
        '—'
      }
    </td>

    <td>
      ${this.escapeHtml(
        project.riskLevel,
      )}
    </td>
  </tr>
  `,
        )
        .join('');

    return `
  <!DOCTYPE html>

  <html lang="fr">

  <head>
  <meta charset="UTF-8">

  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />

  <title>
    ${this.escapeHtml(
      source.report.name,
    )}
  </title>

  <style>
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    background: #f4f6f9;
    color: #172033;
    font-family:
      Arial,
      Helvetica,
      sans-serif;
  }

  .container {
    max-width: 1150px;
    margin: 0 auto;
    padding: 40px;
  }

  .cover {
    min-height: 650px;
    padding: 55px;
    background: #ffffff;
    border-top: 8px solid #172033;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .brand {
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: bold;
  }

  h1 {
    margin: 30px 0 10px;
    font-size: 38px;
  }

  .subtitle {
    font-size: 20px;
    color: #526075;
  }

  .period {
    margin-top: 12px;
    font-size: 15px;
    color: #68758a;
  }

  .section {
    margin-top: 25px;
    background: #ffffff;
    padding: 30px;
  }

  .section h2 {
    margin-top: 0;
    font-size: 24px;
  }

  .stats {
    display: grid;
    grid-template-columns:
      repeat(
        4,
        minmax(
          0,
          1fr
        )
      );
    gap: 16px;
  }

  .stat {
    border: 1px solid #dde3eb;
    border-radius: 8px;
    padding: 20px;
  }

  .stat-value {
    display: block;
    font-size: 27px;
    font-weight: bold;
  }

  .stat-label {
    display: block;
    margin-top: 6px;
    font-size: 13px;
    color: #68758a;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
    font-size: 13px;
  }

  th,
  td {
    padding: 11px;
    border-bottom: 1px solid #e3e7ed;
    text-align: left;
  }

  th {
    background: #f5f7fa;
  }

  .critical {
    font-weight: bold;
  }

  .high {
    font-weight: bold;
  }

  .risk {
    font-size: 24px;
    font-weight: bold;
  }

  .footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid #dde3eb;
    color: #68758a;
    font-size: 12px;
  }

  @media print {
    body {
      background: white;
    }

    .container {
      max-width: none;
      padding: 0;
    }

    .section {
      page-break-inside: avoid;
    }
  }
  </style>

  </head>

  <body>

  <div class="container">

  <section class="cover">

    <div>
      <div class="brand">
        SecureCode
      </div>

      <h1>
        Rapport de sécurité de l’organisation
      </h1>

      <div class="subtitle">
        ${this.escapeHtml(
          source.organization.name,
        )}
      </div>

      <div class="period">
        ${this.escapeHtml(
          period,
        )}
      </div>
    </div>

    <div>
      <div>
        Niveau de risque global
      </div>

      <div class="risk">
        ${this.escapeHtml(
          summary.riskLevel,
        )}
      </div>

      <div class="footer">
        Généré le
        ${this.formatDate(
          source.report.generatedAt,
        )}
      </div>
    </div>

  </section>

  <section class="section">

  <h2>
    Résumé exécutif
  </h2>

  <p>
    Sur la période analysée,
    l’organisation
    <strong>
      ${this.escapeHtml(
        source.organization.name,
      )}
    </strong>
    comprend
    ${summary.projects}
    projet(s),
    ${summary.repositories}
    repository(ies),
    ${summary.scans}
    scan(s) et
    ${summary.findings}
    finding(s).
  </p>

  <p>
    ${summary.activeFindings}
    finding(s) restent actifs.
    Le taux global de remédiation est de
    ${summary.remediationRate} %.
  </p>

  <div class="stats">

    <div class="stat">
      <span class="stat-value">
        ${summary.projects}
      </span>

      <span class="stat-label">
        Projets
      </span>
    </div>

    <div class="stat">
      <span class="stat-value">
        ${summary.scans}
      </span>

      <span class="stat-label">
        Scans
      </span>
    </div>

    <div class="stat">
      <span class="stat-value">
        ${summary.findings}
      </span>

      <span class="stat-label">
        Findings
      </span>
    </div>

    <div class="stat">
      <span class="stat-value">
        ${summary.activeFindings}
      </span>

      <span class="stat-label">
        Findings actifs
      </span>
    </div>

  </div>

  </section>

  <section class="section">

  <h2>
    Sévérités
  </h2>

  <div class="stats">

    <div class="stat">
      <span class="stat-value">
        ${summary.critical}
      </span>

      <span class="stat-label">
        Critical
      </span>
    </div>

    <div class="stat">
      <span class="stat-value">
        ${summary.high}
      </span>

      <span class="stat-label">
        High
      </span>
    </div>

    <div class="stat">
      <span class="stat-value">
        ${summary.medium}
      </span>

      <span class="stat-label">
        Medium
      </span>
    </div>

    <div class="stat">
      <span class="stat-value">
        ${summary.low}
      </span>

      <span class="stat-label">
        Low
      </span>
    </div>

  </div>

  </section>

  <section class="section">

  <h2>
    Analyse par projet
  </h2>

  <table>

  <thead>
  <tr>
    <th>Projet</th>
    <th>Repos</th>
    <th>Scans</th>
    <th>Findings</th>
    <th>Actifs</th>
    <th>Critical</th>
    <th>High</th>
    <th>Score</th>
    <th>Risque</th>
  </tr>
  </thead>

  <tbody>
  ${projectRows}
  </tbody>

  </table>

  </section>

  <section class="section">

  <h2>
    Conclusion
  </h2>

  <p>
    Le niveau de risque global de l’organisation
    est évalué à
    <strong>
      ${this.escapeHtml(
        summary.riskLevel,
      )}
    </strong>.
  </p>

  <p>
    Les efforts de remédiation doivent être
    priorisés sur les projets présentant des
    vulnérabilités critiques ou élevées.
  </p>

  <p>
    Le taux global de remédiation sur la période
    est de
    <strong>
      ${summary.remediationRate} %
    </strong>.
  </p>

  <div class="footer">
    SecureCode —
    rapport généré automatiquement.
  </div>

  </section>

  </div>

  </body>

  </html>
  `;
  }

  async downloadOrganizationPayload(
    organizationId: string,
    reportId: string,
    userId: string,
  ) {
    await this.ensureOrganizationAccess(
      organizationId,
      userId,
    );

    const report =
      await this.prisma.report.findFirst({
        where: {
          id:
            reportId,

          organizationId,

          projectId:
            null,
        },
      });

    if (!report) {
      throw new NotFoundException(
        'Rapport organisation introuvable.',
      );
    }

    if (
      report.status ===
      ReportStatus.EXPIRED
    ) {
      throw new BadRequestException(
        'Ce rapport a expiré.',
      );
    }

    const filters =
      this.parseFilters(
        report.filters,
      );

    if (
      filters.scope !==
      ReportScope.ORGANIZATION
    ) {
      throw new NotFoundException(
        'Ce rapport n’est pas un rapport organisation.',
      );
    }

    const source =
      await this.buildOrganizationSource(
        organizationId,
        report,
      );

    let content:
      Buffer;

    let mimeType:
      string;

    /*
    |--------------------------------------------------------------------------
    | JSON
    |--------------------------------------------------------------------------
    */

    if (
      report.format ===
      ReportFormat.JSON
    ) {
      content =
        Buffer.from(
          JSON.stringify(
            source,
            null,
            2,
          ),
          'utf8',
        );

      mimeType =
        'application/json';
    }

    /*
    |--------------------------------------------------------------------------
    | HTML
    |--------------------------------------------------------------------------
    */

    else if (
      report.format ===
      ReportFormat.HTML
    ) {
      content =
        Buffer.from(
          this.renderOrganizationHtml(
            source,
          ),
          'utf8',
        );

      mimeType =
        'text/html';
    }

    /*
    |--------------------------------------------------------------------------
    | PDF
    |--------------------------------------------------------------------------
    */

    else {
      content =
        await this.renderOrganizationPdf(
          source,
        );

      mimeType =
        'application/pdf';
    }

    /*
    |--------------------------------------------------------------------------
    | Integrity
    |--------------------------------------------------------------------------
    */

    const checksum =
      createHash(
        'sha256',
      )
        .update(
          content,
        )
        .digest(
          'hex',
        );

    /*
    |--------------------------------------------------------------------------
    | Report metadata
    |--------------------------------------------------------------------------
    */

    await this.prisma.report.update({
      where: {
        id:
          report.id,
      },

      data: {
        status:
          ReportStatus.READY,

        fileSize:
          BigInt(
            content.length,
          ),

        checksum,

        generatedAt:
          new Date(),
      },
    });

    /*
    |--------------------------------------------------------------------------
    | Audit
    |--------------------------------------------------------------------------
    */

    await this.prisma.auditLog.create({
      data: {
        organizationId,

        projectId:
          null,

        actorId:
          userId,

        action:
          AuditAction.DOWNLOAD,

        resourceType:
          'OrganizationReport',

        resourceId:
          report.id,

        description:
          `Téléchargement du rapport ${report.name}.`,

        metadata: {
          format:
            report.format,

          scope:
            ReportScope.ORGANIZATION,

          fileSize:
            content.length,

          checksum,

          fromDate:
            source.period.from,

          toDate:
            source.period.to,
        },
      },
    });

    return {
      id:
        report.id,

      format:
        report.format,

      scope:
        ReportScope.ORGANIZATION,

      name:
        report.name,

      mimeType,

      fileSize:
        content.length,

      checksum,

      contentBase64:
        content.toString(
          'base64',
        ),
    };
  }

    private renderOrganizationPdf(
    source:
      OrganizationReportSource,
  ): Promise<Buffer> {
    return new Promise(
      (
        resolve,
        reject,
      ) => {
        const doc =
          new PDFDocument({
            size:
              'A4',

            margins: {
              top:
                45,

              bottom:
                45,

              left:
                48,

              right:
                48,
            },

            info: {
              Title:
                source.report.name,

              Author:
                'SecureCode',

              Subject:
                'Organization Security Report',
            },
          });

        const chunks:
          Buffer[] =
          [];

        doc.on(
          'data',
          (
            chunk,
          ) => {
            chunks.push(
              Buffer.from(
                chunk,
              ),
            );
          },
        );

        doc.on(
          'end',
          () => {
            resolve(
              Buffer.concat(
                chunks,
              ),
            );
          },
        );

        doc.on(
          'error',
          reject,
        );

        const usableWidth =
          doc.page.width -
          96;

        const addSectionTitle =
          (
            title:
              string,
          ) => {
            if (
              doc.y >
              700
            ) {
              doc.addPage();
            }

            doc
              .moveDown(
                0.7,
              )
              .font(
                'Helvetica-Bold',
              )
              .fontSize(
                17,
              )
              .fillColor(
                '#172033',
              )
              .text(
                title,
              );

            doc
              .moveDown(
                0.25,
              )
              .strokeColor(
                '#172033',
              )
              .lineWidth(
                1.2,
              )
              .moveTo(
                48,
                doc.y,
              )
              .lineTo(
                48 +
                  usableWidth,
                doc.y,
              )
              .stroke();

            doc.moveDown(
              0.8,
            );
          };

        /*
        |--------------------------------------------------------------------------
        | Cover
        |--------------------------------------------------------------------------
        */

        doc
          .font(
            'Helvetica-Bold',
          )
          .fontSize(
            13,
          )
          .fillColor(
            '#526075',
          )
          .text(
            'SECURECODE',
          );

        doc.moveDown(
          4,
        );

        doc
          .font(
            'Helvetica-Bold',
          )
          .fontSize(
            28,
          )
          .fillColor(
            '#172033',
          )
          .text(
            'Rapport de sécurité de l’organisation',
          );

        doc.moveDown(
          0.8,
        );

        doc
          .font(
            'Helvetica',
          )
          .fontSize(
            20,
          )
          .fillColor(
            '#38445a',
          )
          .text(
            source.organization
              .name,
          );

        doc.moveDown(
          0.6,
        );

        doc
          .fontSize(
            12,
          )
          .fillColor(
            '#68758a',
          )
          .text(
            `Période : ${this.formatDate(
              source.period.from,
            )} — ${this.formatDate(
              source.period.to,
            )}`,
          );

        doc.moveDown(
          4,
        );

        doc
          .font(
            'Helvetica-Bold',
          )
          .fontSize(
            15,
          )
          .fillColor(
            '#172033',
          )
          .text(
            'Niveau de risque global',
          );

        doc.moveDown(
          0.4,
        );

        doc
          .fontSize(
            24,
          )
          .text(
            source.summary
              .riskLevel,
          );

        doc.moveDown(
          1.5,
        );

        doc
          .font(
            'Helvetica',
          )
          .fontSize(
            10,
          )
          .fillColor(
            '#68758a',
          )
          .text(
            `Généré le ${this.formatDate(
              source.report
                .generatedAt,
            )}`,
          );

        /*
        |--------------------------------------------------------------------------
        | Résumé exécutif
        |--------------------------------------------------------------------------
        */

        doc.addPage();

        addSectionTitle(
          'Résumé exécutif',
        );

        doc
          .font(
            'Helvetica',
          )
          .fontSize(
            11,
          )
          .fillColor(
            '#172033',
          )
          .text(
            `Sur la période analysée, l’organisation ${source.organization.name} comprend ${source.summary.projects} projet(s), ${source.summary.repositories} repository(ies), ${source.summary.scans} scan(s) et ${source.summary.findings} finding(s).`,
            {
              lineGap:
                4,
            },
          );

        doc.moveDown(
          0.8,
        );

        doc.text(
          `${source.summary.activeFindings} finding(s) restent actifs. Le taux global de remédiation est de ${source.summary.remediationRate} %.`,
          {
            lineGap:
              4,
          },
        );

        doc.moveDown(
          1,
        );

        const summaryLines =
          [
            [
              'Projets',
              source.summary
                .projects,
            ],

            [
              'Repositories',
              source.summary
                .repositories,
            ],

            [
              'Scans',
              source.summary
                .scans,
            ],

            [
              'Scans terminés',
              source.summary
                .completedScans,
            ],

            [
              'Scans échoués',
              source.summary
                .failedScans,
            ],

            [
              'Findings',
              source.summary
                .findings,
            ],

            [
              'Findings actifs',
              source.summary
                .activeFindings,
            ],

            [
              'Findings résolus',
              source.summary
                .resolvedFindings,
            ],
          ] as const;

        for (
          const [
            label,
            value,
          ] of summaryLines
        ) {
          doc
            .font(
              'Helvetica-Bold',
            )
            .text(
              `${label}: `,
              {
                continued:
                  true,
              },
            )
            .font(
              'Helvetica',
            )
            .text(
              String(
                value,
              ),
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Severity
        |--------------------------------------------------------------------------
        */

        addSectionTitle(
          'Répartition des sévérités',
        );

        const severities =
          [
            [
              'Critical',
              source.summary
                .critical,
            ],

            [
              'High',
              source.summary
                .high,
            ],

            [
              'Medium',
              source.summary
                .medium,
            ],

            [
              'Low',
              source.summary
                .low,
            ],

            [
              'Info',
              source.summary
                .info,
            ],
          ] as const;

        for (
          const [
            severity,
            count,
          ] of severities
        ) {
          doc
            .font(
              'Helvetica-Bold',
            )
            .text(
              `${severity}: `,
              {
                continued:
                  true,
              },
            )
            .font(
              'Helvetica',
            )
            .text(
              String(
                count,
              ),
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Analyse projet par projet
        |--------------------------------------------------------------------------
        */

        doc.addPage();

        addSectionTitle(
          'Analyse par projet',
        );

        for (
          const project
          of source.projects
        ) {
          if (
            doc.y >
            680
          ) {
            doc.addPage();
          }

          doc
            .font(
              'Helvetica-Bold',
            )
            .fontSize(
              13,
            )
            .fillColor(
              '#172033',
            )
            .text(
              project.name,
            );

          doc
            .moveDown(
              0.2,
            )
            .font(
              'Helvetica',
            )
            .fontSize(
              10,
            )
            .text(
              `Repositories: ${project.repositories} | Scans: ${project.scans} | Findings: ${project.findings}`,
            );

          doc.text(
            `Actifs: ${project.activeFindings} | Critical: ${project.critical} | High: ${project.high}`,
          );

          doc.text(
            `Score moyen: ${
              project.averageScore ??
              'N/A'
            } | Remédiation: ${project.remediationRate} % | Risque: ${project.riskLevel}`,
          );

          doc
            .moveDown(
              0.8,
            )
            .strokeColor(
              '#d5dbe4',
            )
            .lineWidth(
              0.5,
            )
            .moveTo(
              48,
              doc.y,
            )
            .lineTo(
              48 +
                usableWidth,
              doc.y,
            )
            .stroke();

          doc.moveDown(
            0.8,
          );
        }

        /*
        |--------------------------------------------------------------------------
        | Conclusion
        |--------------------------------------------------------------------------
        */

        addSectionTitle(
          'Conclusion',
        );

        doc
          .font(
            'Helvetica',
          )
          .fontSize(
            11,
          )
          .fillColor(
            '#172033',
          )
          .text(
            `Le niveau de risque global de l’organisation est évalué à ${source.summary.riskLevel}.`,
            {
              lineGap:
                4,
            },
          );

        doc.moveDown(
          0.5,
        );

        doc.text(
          `Le taux de remédiation global observé sur la période est de ${source.summary.remediationRate} %.`,
          {
            lineGap:
              4,
          },
        );

        doc.moveDown(
          0.5,
        );

        doc.text(
          'Les projets présentant des findings critiques ou élevés doivent être priorisés dans le plan de remédiation.',
          {
            lineGap:
              4,
          },
        );
        doc.end();
      },
    );
  }
}
