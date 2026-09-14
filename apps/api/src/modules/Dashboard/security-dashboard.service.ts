import { Injectable, NotFoundException } from "@nestjs/common";
import { FindingSeverity, FindingStatus, ScanStatus } from "@prisma/client";
import { PrismaService } from "@securecode-platform/database";

@Injectable()
export class SecurityDashboardService {
  private readonly OWASP_TO_WSTG: Record<string, string> = {
    A01: "WSTG-ATHZ",
    A02: "WSTG-CRYP",
    A03: "WSTG-INPV",
    A04: "WSTG-BUSL",
    A05: "WSTG-CONF",
    A06: "WSTG-ATHN",
    A07: "WSTG-ATHN",
    A08: "WSTG-CONF",
    A09: "WSTG-ERRH",
    A10: "WSTG-INPV",

    "A01:2021": "WSTG-ATHZ",
    "A02:2021": "WSTG-CRYP",
    "A03:2021": "WSTG-INPV",
    "A04:2021": "WSTG-BUSL",
    "A05:2021": "WSTG-CONF",
    "A06:2021": "WSTG-ATHN",
    "A07:2021": "WSTG-ATHN",
    "A08:2021": "WSTG-CONF",
    "A09:2021": "WSTG-ERRH",
    "A10:2021": "WSTG-INPV",
  };

  constructor(private readonly prisma: PrismaService) {}

  async getProjectDashboard(organizationId: string, projectId: string) {
    /**
     * ---------------------------------------------------------
     * 1. PROJECT
     * ---------------------------------------------------------
     */
    const project = await this.prisma.project.findFirst({
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
        "Projet introuvable dans cette organisation.",
      );
    }

    /**
     * ---------------------------------------------------------
     * 2. FINDING STATUSES CONSIDERED AS OPEN
     * ---------------------------------------------------------
     */
    const open: FindingStatus[] = [
      FindingStatus.DETECTED,
      FindingStatus.TO_REVIEW,
      FindingStatus.CONFIRMED,
      FindingStatus.ASSIGNED,
      FindingStatus.IN_PROGRESS,
      FindingStatus.READY_FOR_RETEST,
      FindingStatus.REOPENED,
    ];

    /**
     * ---------------------------------------------------------
     * 3. DASHBOARD DATA
     * ---------------------------------------------------------
     */
    const [
      repositoriesCount,
      scansCount,
      failedScans,
      findingsCount,
      openFindingsCount,
      severityGroups,
      statusGroups,
      latestScan,
      recentScans,
      scoreHistory,
      criticalFindings,
      projectFindings,
    ] = await Promise.all([
      /**
       * Repositories
       */
      this.prisma.repository.count({
        where: {
          organizationId,
          projectId,
          isArchived: false,
        },
      }),

      /**
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

      /**
       * Failed scans
       */
      this.prisma.scan.count({
        where: {
          projectId,
          status: ScanStatus.FAILED,
          repository: {
            organizationId,
          },
        },
      }),

      /**
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

      /**
       * Open findings
       */
      this.prisma.finding.count({
        where: {
          projectId,
          repository: {
            organizationId,
          },
          status: {
            in: open,
          },
        },
      }),

      /**
       * Findings by severity
       */
      this.prisma.finding.groupBy({
        by: ["severity"],
        where: {
          projectId,
          status: {
            in: open,
          },
          repository: {
            organizationId,
          },
        },
        _count: {
          _all: true,
        },
      }),

      /**
       * Findings by status
       */
      this.prisma.finding.groupBy({
        by: ["status"],
        where: {
          projectId,
          repository: {
            organizationId,
          },
        },
        _count: {
          _all: true,
        },
      }),

      /**
       * Latest scan
       */
      this.prisma.scan.findFirst({
        where: {
          projectId,
          repository: {
            organizationId,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
            },
          },
        },
      }),

      /**
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
          createdAt: "desc",
        },
        take: 8,
        include: {
          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
            },
          },
        },
      }),

      /**
       * Score history
       *
       * On récupère davantage de scans terminés
       * pour calculer correctement la tendance.
       */
      this.prisma.scan.findMany({
        where: {
          projectId,
          status: ScanStatus.COMPLETED,
          repository: {
            organizationId,
          },
        },
        orderBy: {
          completedAt: "desc",
        },
        take: 12,
        select: {
          id: true,
          score: true,
          completedAt: true,
          repositoryId: true,
        },
      }),

      /**
       * Critical / High findings
       */
      this.prisma.finding.findMany({
        where: {
          projectId,
          repository: {
            organizationId,
          },
          status: {
            in: open,
          },
          severity: {
            in: [FindingSeverity.CRITICAL, FindingSeverity.HIGH],
          },
        },
        orderBy: [
          {
            severity: "desc",
          },
          {
            updatedAt: "desc",
          },
        ],
        take: 8,
        include: {
          repository: {
            select: {
              id: true,
              name: true,
            },
          },
          assignments: {
            where: {
              unassignedAt: null,
            },
            take: 1,
            orderBy: {
              assignedAt: "desc",
            },
            include: {
              assignedTo: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      }),

      /**
       * All project findings used for:
       *
       * - WSTG score
       * - WSTG breakdown
       */
      this.prisma.finding.findMany({
        where: {
          projectId,
          repository: {
            organizationId,
          },
        },
        select: {
          id: true,
          severity: true,
          status: true,
          owaspCategory: true,
          cweId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const buildCategoryDistribution = (
      values: Array<string | null>,
      fallbackLabel: string,
    ) => {
      const counts = new Map<string, number>();

      for (const value of values) {
        const normalized = value?.trim() || fallbackLabel;

        counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
      }

      return Array.from(counts.entries())
        .map(([category, count]) => ({
          category,
          count,
        }))
        .sort((a, b) => b.count - a.count);
    };

    const owaspDistribution = buildCategoryDistribution(
      projectFindings.map((finding) => finding.owaspCategory),
      "Non classé OWASP",
    );

    const cweDistribution = buildCategoryDistribution(
      projectFindings.map((finding) => finding.cweId),
      "CWE non renseigné",
    );

    /**
     * ---------------------------------------------------------
     * 4. SEVERITY SUMMARY
     * ---------------------------------------------------------
     */
    const severity = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };

    severityGroups.forEach((group) => {
      severity[group.severity] = group._count._all;
    });

    /**
     * ---------------------------------------------------------
     * 5. LATEST SECURITY SCORE
     * ---------------------------------------------------------
     */
    const score =
      latestScan?.score === null || latestScan?.score === undefined
        ? null
        : Number(latestScan.score);

    const grade =
      score === null
        ? null
        : score >= 90
          ? "A"
          : score >= 80
            ? "B"
            : score >= 70
              ? "C"
              : score >= 60
                ? "D"
                : "E";

    /**
     * ---------------------------------------------------------
     * 6. WSTG
     * ---------------------------------------------------------
     */
    const wstgBreakdown = this.buildWstgBreakdown(projectFindings);

    const wstgScore = this.calculateWstgScore(projectFindings);

    /**
     * ---------------------------------------------------------
     * 7. SCAN PERFORMANCE
     * ---------------------------------------------------------
     *
     * IMPORTANT :
     * On utilise scoreHistory et non recentScans,
     * car recentScans peut contenir des scans FAILED/RUNNING.
     */
    const completedScans = scoreHistory.filter(
      (scan) => scan.score !== null && scan.score !== undefined,
    );

    const scanScores = completedScans
      .map((scan) =>
        scan.score !== null && scan.score !== undefined
          ? Number(scan.score)
          : null,
      )
      .filter(
        (scanScore): scanScore is number =>
          scanScore !== null && Number.isFinite(scanScore),
      );

    /**
     * Average score
     */
    const averageScanScore =
      scanScores.length > 0
        ? Number(
            (
              scanScores.reduce((sum, currentScore) => sum + currentScore, 0) /
              scanScores.length
            ).toFixed(2),
          )
        : null;

    /**
     * Success rate
     *
     * Score >= 70 = successful scan
     */
    const successfulScans = scanScores.filter(
      (scanScore) => scanScore >= 70,
    ).length;

    const scanSuccessRate =
      scanScores.length > 0
        ? Number(((successfulScans / scanScores.length) * 100).toFixed(2))
        : 0;

    /**
     * ---------------------------------------------------------
     * 8. SCORE TREND
     * ---------------------------------------------------------
     *
     * scoreHistory est DESC :
     * [latest, previous, ...]
     *
     * On inverse donc pour avoir :
     * [oldest, ..., latest]
     */
    const orderedScores = [...scoreHistory]
      .reverse()
      .map((scan) =>
        scan.score !== null && scan.score !== undefined
          ? Number(scan.score)
          : null,
      )
      .filter(
        (scanScore): scanScore is number =>
          scanScore !== null && Number.isFinite(scanScore),
      );

    let scanTrend: "UP" | "DOWN" | "STABLE" = "STABLE";

    let scoreDelta = 0;

    if (orderedScores.length >= 2) {
      const previous = orderedScores[orderedScores.length - 2];

      const current = orderedScores[orderedScores.length - 1];

      scoreDelta = Number((current - previous).toFixed(2));

      if (scoreDelta > 2) {
        scanTrend = "UP";
      } else if (scoreDelta < -2) {
        scanTrend = "DOWN";
      }
    }

    /**
     * ---------------------------------------------------------
     * 9. RESPONSE
     * ---------------------------------------------------------
     */
    return {
      /**
       * Project
       */
      project,

      /**
       * Main dashboard summary
       */
      summary: {
        repositories: repositoriesCount,

        scans: scansCount,

        failedScans,

        findings: findingsCount,

        openFindings: openFindingsCount,

        securityScore: score,

        grade,

        ...severity,
      },

      /**
       * Severity distribution
       */
      severity,

      /**
       * Finding statuses
       */
      statuses: statusGroups.map((group) => ({
        status: group.status,

        count: group._count._all,
      })),

      /**
       * OWASP distribution
       */
      owasp: owaspDistribution,

      cwe: cweDistribution,

      /**
       * Latest scan
       */
      latestScan: latestScan
        ? {
            ...latestScan,

            score: latestScan.score === null ? null : Number(latestScan.score),
          }
        : null,

      /**
       * Recent scans
       */
      recentScans: recentScans.map((scan) => ({
        ...scan,

        score: scan.score === null ? null : Number(scan.score),
      })),

      /**
       * Score history
       */
      scoreHistory: [...scoreHistory].reverse().map((scan) => ({
        ...scan,

        score: scan.score === null ? null : Number(scan.score),
      })),

      /**
       * Critical / High findings
       */
      criticalFindings,

      /**
       * WSTG
       */
      wstg: {
        score: wstgScore,

        grade: this.getWstgGrade(wstgScore),

        categories: wstgBreakdown,

        totalCategories: wstgBreakdown.length,
      },

      /**
       * Scan performance
       */
      scanPerformance: {
        averageScore: averageScanScore,

        successRate: scanSuccessRate,

        trend: scanTrend,

        scoreDelta,

        completedScans: scanScores.length,
      },
    };
  }

  /**
   * =========================================================
   * WSTG SCORE
   * =========================================================
   */
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
        ? this.mapOwaspToWstg(finding.owaspCategory)
        : "WSTG-OTHER";

      const current = categories.get(wstg) ?? {
        total: 0,
        penalty: 0,
      };

      current.total += 1;

      const severity = finding.severity as keyof typeof penalty;

      current.penalty += penalty[severity] ?? 0;

      categories.set(wstg, current);
    }

    /**
     * Aucun finding classifié :
     * on considère la couverture comme propre
     * plutôt que d'afficher 0.
     */
    if (categories.size === 0) {
      return 100;
    }

    const scores = [...categories.values()].map((category) =>
      Math.max(0, 100 - category.penalty),
    );

    return Number(
      (
        scores.reduce((sum, currentScore) => sum + currentScore, 0) /
        scores.length
      ).toFixed(2),
    );
  }

  /**
   * =========================================================
   * OWASP -> WSTG
   * =========================================================
   */
  private mapOwaspToWstg(owaspCategory: string): string {
    const normalized = owaspCategory.trim().toUpperCase();

    /**
     * Direct mapping
     */
    if (this.OWASP_TO_WSTG[normalized]) {
      return this.OWASP_TO_WSTG[normalized];
    }

    /**
     * Try to extract A01, A02, etc.
     */
    const match = normalized.match(/A(0?[1-9]|10)/);

    if (!match) {
      return "WSTG-OTHER";
    }

    const code = `A${match[1].padStart(2, "0")}`;

    return this.OWASP_TO_WSTG[code] ?? "WSTG-OTHER";
  }

  /**
   * =========================================================
   * WSTG BREAKDOWN
   * =========================================================
   */
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
        ? this.mapOwaspToWstg(finding.owaspCategory)
        : "WSTG-OTHER";

      const current = categories.get(wstg) ?? {
        findings: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        penalty: 0,
      };

      /**
       * Total findings
       */
      current.findings += 1;

      /**
       * Severity breakdown
       */
      switch (finding.severity) {
        case "CRITICAL":
          current.critical += 1;
          break;

        case "HIGH":
          current.high += 1;
          break;

        case "MEDIUM":
          current.medium += 1;
          break;

        case "LOW":
          current.low += 1;
          break;

        case "INFO":
          current.info += 1;
          break;
      }

      /**
       * Security penalty
       */
      const severity = finding.severity as keyof typeof penalty;

      current.penalty += penalty[severity] ?? 0;

      categories.set(wstg, current);
    }

    return [...categories.entries()]
      .map(([code, value]) => {
        const score = Math.max(0, 100 - value.penalty);

        return {
          code,

          name: this.getWstgName(code),

          findings: value.findings,

          critical: value.critical,

          high: value.high,

          medium: value.medium,

          low: value.low,

          info: value.info,

          score: Number(score.toFixed(2)),

          grade: this.getWstgGrade(score),
        };
      })
      .sort((a, b) => b.findings - a.findings);
  }

  /**
   * =========================================================
   * WSTG NAMES
   * =========================================================
   */
  private getWstgName(code: string): string {
    const names: Record<string, string> = {
      "WSTG-ATHZ": "Authorization Testing",

      "WSTG-CRYP": "Cryptography",

      "WSTG-INPV": "Input Validation",

      "WSTG-BUSL": "Business Logic Testing",

      "WSTG-CONF": "Configuration and Deployment",

      "WSTG-ATHN": "Authentication Testing",

      "WSTG-ERRH": "Error Handling",

      "WSTG-OTHER": "Other Security Tests",
    };

    return names[code] ?? code;
  }

  /**
   * =========================================================
   * WSTG GRADE
   * =========================================================
   */
  private getWstgGrade(score: number): string {
    if (score >= 90) {
      return "A";
    }

    if (score >= 80) {
      return "B";
    }

    if (score >= 70) {
      return "C";
    }

    if (score >= 60) {
      return "D";
    }

    return "F";
  }
}
