import {
  Injectable,
} from '@nestjs/common';

import {
  ScanStatus,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

export interface RepositoryScanState {
  repositoryId: string;

  previousSuccessfulSha:
    string | null;

  previousFullScanSha:
    string | null;

  hasSuccessfulScan:
    boolean;
}

@Injectable()
export class RepositoryStateResolverService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async resolve(
    repositoryId: string,
  ): Promise<RepositoryScanState> {
    const [
      latestSuccessfulScan,
      latestFullScan,
    ] =
      await Promise.all([
        this.prisma.scan.findFirst({
          where: {
            repositoryId,

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
        }),

        this.prisma.scan.findFirst({
          where: {
            repositoryId,

            status:
              ScanStatus.COMPLETED,

            type:
              'FULL_SCAN',
          },

          orderBy: {
            completedAt:
              'desc',
          },

          select: {
            commitSha:
              true,
          },
        }),
      ]);

    return {
      repositoryId,

      previousSuccessfulSha:
        latestSuccessfulScan
          ?.commitSha ??
        null,

      previousFullScanSha:
        latestFullScan
          ?.commitSha ??
        null,

      hasSuccessfulScan:
        Boolean(
          latestSuccessfulScan,
        ),
    };
  }
}
