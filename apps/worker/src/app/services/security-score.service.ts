import {
  Injectable,
} from '@nestjs/common';

import {
  FindingSeverity,
  FindingStatus,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';


export interface SecurityScoreResult {
  score: number;

  reliable: boolean;

  critical: number;

  high: number;

  medium: number;

  low: number;
  
  info: number;
}

@Injectable()
export class SecurityScoreService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async calculate(
    repositoryId:string,
    reliable: boolean = true,
  ): Promise<SecurityScoreResult> {
    const activeFindings =
      await this.prisma.finding.groupBy({
        by: [
          'severity',
        ],

        where: {
          repositoryId,

          status: {
            notIn: [
              FindingStatus.FIXED,
              FindingStatus.FALSE_POSITIVE,
              FindingStatus.CLOSED,
            ],
          },
        },

        _count: {
          _all:
            true,
        },
      });

    const counts = {
      critical:
        0,

      high:
        0,

      medium:
        0,

      low:
        0,

      info:
        0,
    };

    for (
      const row of
        activeFindings
    ) {
      const count =
        row._count._all;

      switch (
        row.severity
      ) {
        case FindingSeverity.CRITICAL:
          counts.critical +=
            count;
          break;

        case FindingSeverity.HIGH:
          counts.high +=
            count;
          break;

        case FindingSeverity.MEDIUM:
          counts.medium +=
            count;
          break;

        case FindingSeverity.LOW:
          counts.low +=
            count;
          break;

        default:
          counts.info +=
            count;
      }
    }

    const penalty =
      counts.critical *
        25 +
      counts.high *
        12 +
      counts.medium *
        5 +
      counts.low *
        2 +
      counts.info *
        0.25;

    const score =
      Math.max(
        0,
        Math.min(
          100,
          Number(
            (
              100 -
              penalty
            ).toFixed(
              2,
            ),
          ),
        ),
      );

    return {
      score,
      reliable,
      ...counts,
    };
  }
}
