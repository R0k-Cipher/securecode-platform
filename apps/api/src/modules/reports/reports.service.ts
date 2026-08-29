import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AuditAction,
  FindingSeverity,
  NotificationType,
  ReportFormat,
  ReportStatus,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  createHash,
} from 'node:crypto';

import {
  CreateReportDto,
} from './dto/create-report.dto';

import {
  NotificationsService,
} from '../notifications/notifications.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma:
      PrismaService,

    private readonly notifications:
      NotificationsService,
  ) {}

  async list(
    organizationId: string,
    projectId: string,
    userId: string,
  ) {
    await this.ensureAccess(
      organizationId,
      projectId,
      userId,
    );

    const data =
      await this.prisma.report
        .findMany({
          where: {
            projectId,
          },

          orderBy: {
            createdAt:
              'desc',
          },

          select: {
            id: true,
            projectId: true,
            scanId: true,
            requestedById: true,
            status: true,
            format: true,
            name: true,
            fileSize: true,
            checksum: true,
            generatedAt: true,
            expiresAt: true,
            errorMessage: true,
            createdAt: true,

            requestedBy: {
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
      data:
        data.map(
          (item) => ({
            ...item,

            fileSize:
              item.fileSize ===
              null
                ? null
                : Number(
                    item.fileSize,
                  ),
          }),
        ),
    };
  }

  async create(
    organizationId: string,
    projectId: string,
    userId: string,
    dto: CreateReportDto,
  ) {
    await this.ensureAccess(
      organizationId,
      projectId,
      userId,
    );

    const project =
      await this.prisma.project
        .findFirst({
          where: {
            id:
              projectId,

            organizationId,
          },

          select: {
            id: true,
            name: true,
          },
        });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable.',
      );
    }

    let scanId =
      dto.scanId;

    if (!scanId) {
      const latest =
        await this.prisma.scan
          .findFirst({
            where: {
              projectId,
              organizationId,
            },

            orderBy: {
              createdAt:
                'desc',
            },

            select: {
              id:
                true,
            },
          });

      scanId =
        latest?.id;
    }

    if (!scanId) {
      throw new NotFoundException(
        'Aucun scan disponible pour générer un rapport.',
      );
    }

    const scan =
      await this.prisma.scan
        .findFirst({
          where: {
            id:
              scanId,

            projectId,
            organizationId,
          },

          select: {
            id: true,
          },
        });

    if (!scan) {
      throw new NotFoundException(
        'Scan introuvable pour ce projet.',
      );
    }

    const now =
      new Date();

    const extension =
      dto.format
        .toLowerCase();

    const name =
      `securecode-${this.slug(
        project.name,
      )}-${now
        .toISOString()
        .slice(
          0,
          10,
        )}.${extension}`;

    const report =
      await this.prisma.report
        .create({
          data: {
            projectId,
            scanId,
            requestedById:
              userId,

            status:
              ReportStatus.READY,

            format:
              dto.format,

            name,

            generatedAt:
              now,

            expiresAt:
              new Date(
                now.getTime() +
                30 *
                  24 *
                  60 *
                  60 *
                  1000,
              ),
          },
        });

    await this.prisma.auditLog
      .create({
        data: {
          organizationId,
          projectId,
          actorId:
            userId,

          action:
            AuditAction.EXPORT,

          resourceType:
            'Report',

          resourceId:
            report.id,

          description:
            `Rapport ${report.format} généré`,
        },
      });

    await this.notifications
      .create({
        userId,

        type:
          NotificationType.REPORT_READY,

        title:
          'Rapport disponible',

        message:
          `Le rapport "${report.name}" est prêt au téléchargement.`,

        metadata: {
          reportId:
            report.id,

          projectId,
          scanId,
        },
      });

    return report;
  }

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
      await this.prisma.report
        .findFirst({
          where: {
            id:
              reportId,

            projectId,
          },
        });

    if (!report) {
      throw new NotFoundException(
        'Rapport introuvable.',
      );
    }

    if (
      report.status !==
      ReportStatus.READY
    ) {
      throw new ForbiddenException(
        'Le rapport n’est pas prêt.',
      );
    }

    const source =
      await this.buildSource(
        organizationId,
        projectId,
        report.scanId,
      );

    let content:
      string;

    let mimeType:
      string;

    if (
      report.format ===
      ReportFormat.JSON
    ) {
      content =
        JSON.stringify(
          source,
          null,
          2,
        );

      mimeType =
        'application/json';
    } else {
      content =
        this.buildHtml(
          source,
        );

      mimeType =
        'text/html;charset=utf-8';
    }

    /*
     * Pour PDF, le frontend ouvre le HTML dans une fenêtre
     * d'impression et utilise "Enregistrer au format PDF".
     * Cela évite Chromium/Puppeteer dans l'API.
     */
    const effectiveMimeType =
      report.format ===
      ReportFormat.PDF
        ? 'text/html;charset=utf-8'
        : mimeType;

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

    const size =
      Buffer.byteLength(
        content,
        'utf8',
      );

    await this.prisma.report
      .update({
        where: {
          id:
            report.id,
        },

        data: {
          checksum,

          fileSize:
            BigInt(
              size,
            ),
        },
      });

    return {
      id:
        report.id,

      format:
        report.format,

      name:
        report.name,

      mimeType:
        effectiveMimeType,

      content,

      printAsPdf:
        report.format ===
        ReportFormat.PDF,
    };
  }

  private async buildSource(
    organizationId: string,
    projectId: string,
    scanId:
      string | null,
  ) {
    const project =
      await this.prisma.project
        .findFirstOrThrow({
          where: {
            id:
              projectId,

            organizationId,
          },

          select: {
            id: true,
            name: true,
            slug: true,

            organization: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

    const scan =
      scanId
        ? await this.prisma.scan
            .findFirst({
              where: {
                id:
                  scanId,

                projectId,
                organizationId,
              },

              select: {
                id: true,
                type: true,
                trigger: true,
                status: true,
                branch: true,
                commitSha: true,
                score: true,
                queuedAt: true,
                startedAt: true,
                completedAt: true,

                repository: {
                  select: {
                    id: true,
                    fullName: true,
                    provider: true,
                  },
                },
              },
            })
        : null;

    const findings =
      await this.prisma.finding
        .findMany({
          where: {
            projectId,

            ...(scanId
              ? {
                  occurrences: {
                    some: {
                      scanId,
                    },
                  },
                }
              : {}),
          },

          orderBy: [
            {
              severity:
                'desc',
            },

            {
              createdAt:
                'desc',
            },
          ],

          select: {
            id: true,
            title: true,
            description: true,
            severity: true,
            status: true,
            ruleId: true,
            scanner: true,
            category: true,
            owaspCategory: true,
            cweId: true,
            cvssScore: true,
            filePath: true,
            startLine: true,
            endLine: true,
            recommendation: true,
            confidence: true,
            firstDetectedAt: true,
            lastDetectedAt: true,
          },
        });

    const severity =
      {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        INFO: 0,
      };

    for (
      const finding
      of findings
    ) {
      severity[
        finding.severity
      ] +=
        1;
    }

    return {
      generatedAt:
        new Date()
          .toISOString(),

      project,

      scan:
        scan
          ? {
              ...scan,

              score:
                scan.score ===
                null
                  ? null
                  : Number(
                      scan.score,
                    ),
            }
          : null,

      summary: {
        total:
          findings.length,

        severity,
      },

      findings:
        findings.map(
          (finding) => ({
            ...finding,

            cvssScore:
              finding.cvssScore ===
              null
                ? null
                : Number(
                    finding.cvssScore,
                  ),

            confidence:
              finding.confidence ===
              null
                ? null
                : Number(
                    finding.confidence,
                  ),
          }),
        ),
    };
  }

  private buildHtml(
    source: Awaited<
      ReturnType<
        ReportsService[
          'buildSource'
        ]
      >
    >,
  ): string {
    const rows =
      source.findings
        .map(
          (
            finding,
          ) =>
            `
            <tr>
              <td><strong>${this.escape(
                finding.severity,
              )}</strong></td>
              <td>${this.escape(
                finding.title,
              )}<div class="muted">${this.escape(
                finding.ruleId,
              )}</div></td>
              <td>${this.escape(
                finding.status,
              )}</td>
              <td>${this.escape(
                finding.filePath ??
                '—',
              )}${
                finding.startLine
                  ? `:${finding.startLine}`
                  : ''
              }</td>
              <td>${this.escape(
                finding.cweId ??
                '—',
              )}</td>
            </tr>
            `,
        )
        .join(
          '',
        );

    return `
    <!doctype html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <title>SecureCode Security Report</title>
      <style>
        *{box-sizing:border-box}
        body{margin:0;background:#f6f8fb;color:#0f172a;font-family:Arial,sans-serif}
        .page{max-width:1100px;margin:0 auto;padding:38px}
        header{padding:26px 28px;border-radius:14px;background:#0b1220;color:white}
        header small{color:#94a3b8;letter-spacing:.12em}
        h1{margin:8px 0 4px;font-size:26px}
        .meta{color:#cbd5e1;font-size:12px}
        .grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:18px 0}
        .kpi{padding:16px;border:1px solid #e2e8f0;border-radius:10px;background:white}
        .kpi span{display:block;color:#64748b;font-size:10px;text-transform:uppercase}
        .kpi strong{display:block;margin-top:8px;font-size:23px}
        section{margin-top:18px;padding:20px;border:1px solid #e2e8f0;border-radius:12px;background:white}
        table{width:100%;border-collapse:collapse}
        th,td{padding:10px 9px;border-bottom:1px solid #eef2f7;text-align:left;vertical-align:top;font-size:11px}
        th{color:#64748b;font-size:9px;text-transform:uppercase}
        .muted{margin-top:3px;color:#94a3b8;font-size:9px}
        .finding{page-break-inside:avoid;margin-top:14px;padding-top:14px;border-top:1px solid #eef2f7}
        .finding h3{margin:0 0 6px;font-size:14px}
        .finding p{margin:5px 0;color:#475569;font-size:11px;line-height:1.55}
        @media print{body{background:white}.page{max-width:none;padding:0}header,section,.kpi{break-inside:avoid}}
      </style>
    </head>
    <body>
      <div class="page">
        <header>
          <small>SECURECODE — SECURITY ASSESSMENT REPORT</small>
          <h1>${this.escape(
            source.project.name,
          )}</h1>
          <div class="meta">
            Organisation: ${this.escape(
              source.project.organization.name,
            )}
            · Repository: ${this.escape(
              source.scan?.repository.fullName ??
              '—',
            )}
            · Généré le ${new Date(
              source.generatedAt,
            ).toLocaleString(
              'fr-FR',
            )}
          </div>
        </header>

        <div class="grid">
          <div class="kpi"><span>Score</span><strong>${source.scan?.score ?? '—'}</strong></div>
          <div class="kpi"><span>Total</span><strong>${source.summary.total}</strong></div>
          <div class="kpi"><span>Critical</span><strong>${source.summary.severity.CRITICAL}</strong></div>
          <div class="kpi"><span>High</span><strong>${source.summary.severity.HIGH}</strong></div>
          <div class="kpi"><span>Medium</span><strong>${source.summary.severity.MEDIUM}</strong></div>
          <div class="kpi"><span>Low</span><strong>${source.summary.severity.LOW}</strong></div>
        </div>

        <section>
          <h2>Résumé des findings</h2>
          <table>
            <thead>
              <tr>
                <th>Sévérité</th>
                <th>Finding</th>
                <th>Statut</th>
                <th>Emplacement</th>
                <th>CWE</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="5">Aucun finding.</td></tr>'}
            </tbody>
          </table>
        </section>

        <section>
          <h2>Détails et remédiations</h2>
          ${source.findings
            .map(
              (
                finding,
                index,
              ) =>
                `
                <div class="finding">
                  <h3>${index + 1}. ${this.escape(
                    finding.title,
                  )}</h3>
                  <p><strong>${this.escape(
                    finding.severity,
                  )}</strong> · ${this.escape(
                    finding.ruleId,
                  )} · ${this.escape(
                    finding.cweId ??
                    'CWE —',
                  )}</p>
                  <p>${this.escape(
                    finding.description,
                  )}</p>
                  <p><strong>Emplacement :</strong> ${this.escape(
                    finding.filePath ??
                    '—',
                  )}${
                    finding.startLine
                      ? ` ligne ${finding.startLine}`
                      : ''
                  }</p>
                  <p><strong>Recommandation :</strong> ${this.escape(
                    finding.recommendation ??
                    'Aucune recommandation fournie.',
                  )}</p>
                </div>
                `,
            )
            .join(
              '',
            )}
        </section>
      </div>
    </body>
    </html>
    `;
  }

  private async ensureAccess(
    organizationId: string,
    projectId: string,
    userId: string,
  ) {
    const membership =
      await this.prisma.organizationMember
        .findFirst({
          where: {
            organizationId,
            userId,
          },

          select: {
            id: true,
          },
        });

    if (!membership) {
      throw new ForbiddenException(
        'Accès refusé à cette organisation.',
      );
    }

    const project =
      await this.prisma.project
        .findFirst({
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

  private slug(
    value: string,
  ) {
    return value
      .normalize(
        'NFD',
      )
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-',
      )
      .replace(
        /^-+|-+$/g,
        '',
      )
      .slice(
        0,
        60,
      );
  }

  private escape(
    value: string,
  ) {
    return String(
      value,
    )
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
}
