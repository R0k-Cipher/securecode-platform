import { Injectable, Logger } from '@nestjs/common';
import { FindingSeverity, FindingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@securecode-platform/database';
import {
  calculateContextualRisk,
  CONTEXTUAL_RISK_ENGINE_VERSION,
  extractCveIds,
} from '@securecode-platform/shared-utils';
import { ThreatIntelligenceService } from './threat-intelligence.service';

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
export class ContextualRiskService {
  private readonly logger = new Logger(ContextualRiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly threatIntelligence: ThreatIntelligenceService,
  ) {}

  async assessScan(input: {
    organizationId: string;
    projectId: string;
    repositoryId: string;
    scanId: string;
    branch: string;
  }): Promise<{ assessed: number; attackPaths: number }> {
    const repository = await this.prisma.repository.findFirst({
      where: {
        id: input.repositoryId,
        projectId: input.projectId,
        organizationId: input.organizationId,
      },
      select: { visibility: true },
    });

    if (!repository)
      throw new Error('Contexte tenant invalide pour le moteur de risque.');

    const findings = await this.prisma.finding.findMany({
      where: {
        scanId: input.scanId,
        projectId: input.projectId,
        repositoryId: input.repositoryId,
        status: { in: OPEN_STATUSES },
      },
      select: {
        id: true,
        ruleId: true,
        scanner: true,
        title: true,
        description: true,
        severity: true,
        category: true,
        owaspCategory: true,
        cweId: true,
        cvssScore: true,
        filePath: true,
        metadata: true,
      },
    });

    const cveIds = findings.flatMap((finding) =>
      extractCveIds(finding.ruleId, this.record(finding.metadata)),
    );
    const intelligence = await this.threatIntelligence.enrich(cveIds);
    const assessed: Array<{
      findingId: string;
      title: string;
      category: string;
      severity: FindingSeverity;
      score: number;
      priority: string;
      exposed: boolean | null;
    }> = [];

    for (const finding of findings) {
      const metadata = this.record(finding.metadata);
      const ids = extractCveIds(finding.ruleId, metadata);
      const signals = ids.map((id) => intelligence.get(id)).filter(Boolean);
      const epssScore = signals.reduce<number | null>(
        (max, item) =>
          item?.epssScore == null ? max : Math.max(max ?? 0, item.epssScore),
        null,
      );
      const knownExploited = signals.some((item) => item?.knownExploited);
      const result = calculateContextualRisk({
        severity: finding.severity,
        cvssScore: finding.cvssScore == null ? null : Number(finding.cvssScore),
        scanner: finding.scanner,
        category: finding.category,
        owaspCategory: finding.owaspCategory,
        cweId: finding.cweId,
        filePath: finding.filePath,
        title: finding.title,
        description: finding.description,
        metadata,
        repositoryVisibility: repository.visibility,
        branch: input.branch,
        epssScore,
        knownExploited,
      });

      await this.prisma.riskAssessment.upsert({
        where: { findingId: finding.id },
        create: {
          organizationId: input.organizationId,
          projectId: input.projectId,
          repositoryId: input.repositoryId,
          scanId: input.scanId,
          findingId: finding.id,
          contextualScore: result.contextualScore,
          priority: result.priority,
          epssScore,
          knownExploited,
          reachable: result.reachable,
          internetExposed: result.internetExposed,
          assetCriticality: result.assetCriticality,
          confidence: result.confidence,
          factors: result.factors as Prisma.InputJsonValue,
          explanation: result.explanation as Prisma.InputJsonValue,
          evidence: {
            ...result.evidence,
            cveIds: ids,
            sources: Array.from(
              new Set(signals.flatMap((item) => item?.sources ?? [])),
            ),
          } as Prisma.InputJsonValue,
          engineVersion: CONTEXTUAL_RISK_ENGINE_VERSION,
        },
        update: {
          scanId: input.scanId,
          contextualScore: result.contextualScore,
          priority: result.priority,
          epssScore,
          knownExploited,
          reachable: result.reachable,
          internetExposed: result.internetExposed,
          assetCriticality: result.assetCriticality,
          confidence: result.confidence,
          factors: result.factors as Prisma.InputJsonValue,
          explanation: result.explanation as Prisma.InputJsonValue,
          evidence: {
            ...result.evidence,
            cveIds: ids,
            sources: Array.from(
              new Set(signals.flatMap((item) => item?.sources ?? [])),
            ),
          } as Prisma.InputJsonValue,
          engineVersion: CONTEXTUAL_RISK_ENGINE_VERSION,
          calculatedAt: new Date(),
        },
      });

      assessed.push({
        findingId: finding.id,
        title: finding.title,
        category:
          `${finding.category ?? ''} ${finding.owaspCategory ?? ''}`.toLowerCase(),
        severity: finding.severity,
        score: result.contextualScore,
        priority: result.priority,
        exposed: result.internetExposed,
      });
    }

    const attackPaths = await this.persistAttackPaths(input, assessed);
    await this.prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        projectId: input.projectId,
        action: 'SCAN',
        resourceType: 'SecurityIntelligence',
        resourceId: input.scanId,
        description:
          'Évaluation contextuelle et corrélation des chemins d’attaque terminées.',
        metadata: {
          scanId: input.scanId,
          repositoryId: input.repositoryId,
          assessedFindings: assessed.length,
          attackPaths,
          engineVersion: CONTEXTUAL_RISK_ENGINE_VERSION,
        },
      },
    });
    this.logger.log(
      `${assessed.length} risques et ${attackPaths} chemins d'attaque calculés.`,
    );
    return { assessed: assessed.length, attackPaths };
  }

  private async persistAttackPaths(
    input: {
      organizationId: string;
      projectId: string;
      repositoryId: string;
      scanId: string;
    },
    findings: Array<{
      findingId: string;
      title: string;
      category: string;
      severity: FindingSeverity;
      score: number;
      priority: string;
      exposed: boolean | null;
    }>,
  ): Promise<number> {
    await this.prisma.attackPath.updateMany({
      where: {
        repositoryId: input.repositoryId,
        status: 'OPEN',
        scanId: { not: input.scanId },
      },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    await this.prisma.attackPath.deleteMany({
      where: { scanId: input.scanId },
    });
    const entry = findings.filter(
      (item) =>
        item.exposed === true ||
        /auth|idor|ssrf|injection|upload|redirect/.test(
          item.category + item.title.toLowerCase(),
        ),
    );
    const impact = findings.filter((item) =>
      /sql|database|command|rce|secret|token|deserial|dependency/.test(
        item.category + item.title.toLowerCase(),
      ),
    );
    const pairs = entry
      .flatMap((source) => impact.map((target) => ({ source, target })))
      .filter((pair) => pair.source.findingId !== pair.target.findingId)
      .sort(
        (a, b) =>
          b.source.score + b.target.score - (a.source.score + a.target.score),
      )
      .slice(0, 10);

    for (const pair of pairs) {
      const score = Math.min(
        100,
        Math.round(
          (pair.source.score * 0.45 + pair.target.score * 0.55 + 10) * 100,
        ) / 100,
      );
      const severity =
        score >= 85
          ? FindingSeverity.CRITICAL
          : score >= 65
            ? FindingSeverity.HIGH
            : FindingSeverity.MEDIUM;
      await this.prisma.attackPath.create({
        data: {
          organizationId: input.organizationId,
          projectId: input.projectId,
          repositoryId: input.repositoryId,
          scanId: input.scanId,
          title: `${pair.source.title} → ${pair.target.title}`,
          severity,
          score,
          entryPoint: pair.source.title,
          targetAsset: pair.target.title,
          findingIds: [
            pair.source.findingId,
            pair.target.findingId,
          ] as Prisma.InputJsonValue,
          graph: {
            nodes: [
              {
                id: pair.source.findingId,
                label: pair.source.title,
                type: 'ENTRY_POINT',
              },
              {
                id: pair.target.findingId,
                label: pair.target.title,
                type: 'IMPACT',
              },
            ],
            edges: [
              {
                from: pair.source.findingId,
                to: pair.target.findingId,
                relation: 'CAN_ENABLE',
              },
            ],
          } as Prisma.InputJsonValue,
          evidence: {
            methodology:
              'Corrélation déterministe entre point d’entrée et impact potentiel',
            sourceRisk: pair.source.score,
            targetRisk: pair.target.score,
          } as Prisma.InputJsonValue,
        },
      });
    }
    return pairs.length;
  }

  private record(value: Prisma.JsonValue | null): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
}
