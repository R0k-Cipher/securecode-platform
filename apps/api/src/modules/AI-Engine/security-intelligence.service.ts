import { Injectable, NotFoundException } from '@nestjs/common';
import { FindingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@securecode-platform/database';

const OPEN_STATUSES: FindingStatus[] = [
  FindingStatus.DETECTED,
  FindingStatus.TO_REVIEW,
  FindingStatus.CONFIRMED,
  FindingStatus.ASSIGNED,
  FindingStatus.IN_PROGRESS,
  FindingStatus.READY_FOR_RETEST,
  FindingStatus.REOPENED,
];

@Injectable()
export class SecurityIntelligenceService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true, name: true },
    });
    if (!project)
      throw new NotFoundException(
        'Projet introuvable dans cette organisation.',
      );
    return project;
  }

  async overview(organizationId: string, projectId: string) {
    const project = await this.ensureProject(organizationId, projectId);
    const [assessments, attackPaths, summaryRows, grouped] = await Promise.all([
      this.prisma.riskAssessment.findMany({
        where: {
          organizationId,
          projectId,
          finding: { status: { in: OPEN_STATUSES } },
        },
        orderBy: [{ contextualScore: 'desc' }, { calculatedAt: 'desc' }],
        take: 20,
        include: {
          finding: {
            select: {
              id: true,
              title: true,
              severity: true,
              status: true,
              cweId: true,
              owaspCategory: true,
              filePath: true,
            },
          },
          repository: { select: { id: true, name: true, fullName: true } },
        },
      }),
      this.prisma.attackPath.findMany({
        where: { organizationId, projectId, status: 'OPEN' },
        orderBy: [{ score: 'desc' }, { detectedAt: 'desc' }],
        take: 10,
        include: {
          repository: { select: { id: true, name: true, fullName: true } },
        },
      }),
      this.prisma.riskAssessment.findMany({
        where: {
          organizationId,
          projectId,
          finding: { status: { in: OPEN_STATUSES } },
        },
        select: {
          knownExploited: true,
          reachable: true,
          internetExposed: true,
        },
      }),
      this.prisma.riskAssessment.groupBy({
        by: ['priority'],
        where: {
          organizationId,
          projectId,
          finding: { status: { in: OPEN_STATUSES } },
        },
        _count: { _all: true },
      }),
    ]);

    const distribution = Object.fromEntries(
      ['IMMEDIATE', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => [
        priority,
        grouped.find((item) => item.priority === priority)?._count._all ?? 0,
      ]),
    );

    return {
      project,
      generatedAt: new Date().toISOString(),
      summary: {
        assessedFindings: summaryRows.length,
        knownExploited: summaryRows.filter((item) => item.knownExploited)
          .length,
        reachable: summaryRows.filter((item) => item.reachable === true).length,
        internetExposed: summaryRows.filter(
          (item) => item.internetExposed === true,
        ).length,
        openAttackPaths: attackPaths.length,
        distribution,
      },
      topRisks: assessments.map((item) => this.serializeAssessment(item)),
      attackPaths: attackPaths.map((item) => ({
        ...item,
        score: Number(item.score),
      })),
    };
  }

  async findingRisk(
    organizationId: string,
    projectId: string,
    findingId: string,
  ) {
    await this.ensureProject(organizationId, projectId);
    const finding = await this.prisma.finding.findFirst({
      where: {
        id: findingId,
        projectId,
        repository: { organizationId },
      },
      select: { id: true },
    });
    if (!finding) throw new NotFoundException('Finding introuvable.');

    const assessment = await this.prisma.riskAssessment.findUnique({
      where: { findingId },
      include: {
        repository: { select: { id: true, name: true, fullName: true } },
      },
    });
    return assessment ? this.serializeAssessment(assessment) : null;
  }

  private serializeAssessment<
    T extends {
      contextualScore: Prisma.Decimal;
      epssScore: Prisma.Decimal | null;
      confidence: Prisma.Decimal;
    },
  >(assessment: T) {
    return {
      ...assessment,
      contextualScore: Number(assessment.contextualScore),
      epssScore:
        assessment.epssScore == null ? null : Number(assessment.epssScore),
      confidence: Number(assessment.confidence),
    };
  }
}
