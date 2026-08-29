import {
  Injectable,
} from '@nestjs/common';

import {
  FindingStatus,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

export interface ReconcileFindingsInput {
  repositoryId: string;

  scanId: string;

  mode:
    | 'FULL'
    | 'INCREMENTAL'
    | 'PULL_REQUEST';

  detectedFingerprints:
    string[];

  scannedFiles:
    string[];

  deletedFiles:
    string[];
}

export interface ReconcileFindingsResult {
  fixed:
    number;

  unchanged:
    number;
}

@Injectable()
export class FindingReconciliationService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async reconcile(
    input:
      ReconcileFindingsInput,
  ): Promise<ReconcileFindingsResult> {
    const detected =
      new Set(
        input.detectedFingerprints,
      );

    const scannedFiles =
      new Set(
        input.scannedFiles.map(
          (file) =>
            this.normalizePath(
              file,
            ),
        ),
      );

    const deletedFiles =
      new Set(
        input.deletedFiles.map(
          (file) =>
            this.normalizePath(
              file,
            ),
        ),
      );

    const candidates =
      await this.prisma.finding.findMany({
        where: {
          repositoryId:
            input.repositoryId,

          status: {
            notIn: [
              FindingStatus.FIXED,
              FindingStatus.CLOSED,
            ],
          },
        },

        select: {
          id:true,

          fingerprint:true,

          filePath:true,

          status: true,

          metadata: true,
        },
      });

    let fixed =
      0;

    let unchanged =
      0;

    for (
      const finding of
        candidates
    ) {
      if (
        detected.has(
          finding.fingerprint,
        )
      ) {
        unchanged +=
          1;

        continue;
      }

      const normalizedFilePath =
        finding.filePath
          ? this.normalizePath(
              finding.filePath,
            )
          : null;

      const shouldFix =
        this.shouldMarkFixed({
          mode:
            input.mode,

          filePath:
            normalizedFilePath,

          scannedFiles,

          deletedFiles,
        });

      if (!shouldFix) {
        unchanged +=
          1;
        continue;
      }


      await this.prisma.finding.update({
        where: {
          id:
            finding.id,
        },

        data: {
          status:
            FindingStatus.FIXED,

          resolvedAt:
            new Date(),

        metadata: {
          ...(
            finding.metadata &&
            typeof finding.metadata === 'object' &&
            !Array.isArray(finding.metadata)
              ? finding.metadata
              : {}
          ),

          reconciledByScanId:
            input.scanId,

          reconciliationReason:
            deletedFiles.has(
              normalizedFilePath ?? '',
            )
              ? 'FILE_DELETED'
              : input.mode === 'FULL'
                ? 'ABSENT_FROM_FULL_SCAN'
                : 'ABSENT_FROM_RESCANNED_FILE',
        },
        },
      });

      fixed +=
        1;
    }

    return {
      fixed,
      unchanged,
    };
  }

  private shouldMarkFixed(
    input: {
      mode:
        | 'FULL'
        | 'INCREMENTAL'
        | 'PULL_REQUEST';

      filePath:
        string | null;

      scannedFiles:
        Set<string>;

      deletedFiles:
        Set<string>;
    },
  ): boolean {
    if (
      input.filePath &&
      input.deletedFiles.has(
        input.filePath,
      )
    ) {
      return true;
    }

    if (
      input.mode ===
      'FULL'
    ) {
      return true;
    }

    if (
      !input.filePath
    ) {
      return false;
    }

    return input.scannedFiles.has(
      input.filePath,
    );
  }

  private normalizePath(
    path:
      string,
  ): string {
    return path
      .replace(/\\/g, '/')
      .replace(
        /^\.\/+/,
        '',
      );
  }
}
