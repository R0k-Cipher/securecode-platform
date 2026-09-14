import {
  Injectable,
} from '@nestjs/common';

import type {
  ChangeSet,
} from '@securecode-platform/scanner-core';

import {
  GithubWorkerClientService,
} from './github-worker-client.service';

interface GithubCompareFile {
  filename: string;

  previous_filename?: string;

  status:
    | 'added'
    | 'modified'
    | 'removed'
    | 'renamed'
    | 'copied'
    | 'changed'
    | 'unchanged';

  additions?: number;
  deletions?: number;
  changes?: number;
}

interface GithubCompareResponse {
  status:
    | 'ahead'
    | 'behind'
    | 'diverged'
    | 'identical';

  ahead_by: number;

  behind_by: number;

  total_commits: number;

  files?: GithubCompareFile[];
}

export interface GithubCompareInput {
  installationId: string;

  repositoryId: string;

  owner: string;

  repositoryName: string;

  fromSha: string;

  toSha: string;
}

@Injectable()
export class GithubCompareService {
  constructor(
    private readonly githubClient:
      GithubWorkerClientService,
  ) {}

  async compare(
    input: GithubCompareInput,
  ): Promise<ChangeSet> {
    const token =
      await this.githubClient
        .createInstallationAccessToken(
          input.installationId,
        );

    const controller =
      new AbortController();

    const timeout =
      setTimeout(
        () =>
          controller.abort(),
        20_000,
      );

    try {
      const url =
        `https://api.github.com/repos/` +
        `${encodeURIComponent(input.owner)}/` +
        `${encodeURIComponent(input.repositoryName)}/` +
        `compare/` +
        `${encodeURIComponent(input.fromSha)}...` +
        `${encodeURIComponent(input.toSha)}`;

      const response =
        await fetch(
          url,
          {
            method:
              'GET',

            headers:
              this.githubClient
                .createInstallationHeaders(
                  token,
                ),

            signal:
              controller.signal,
          },
        );

      if (
        response.status === 404
      ) {
        return this.fullScanFallback(
          input,
          'GitHub ne peut pas comparer les deux commits.',
        );
      }

      if (!response.ok) {
        return this.fullScanFallback(
          input,
          `GitHub Compare HTTP ${response.status}.`,
        );
      }

      const data =
        (await response.json()) as
          GithubCompareResponse;

      /*
       * Une divergence d'historique peut
       * correspondre à un rebase/force-push.
       */
      if (
        data.status ===
        'diverged'
      ) {
        return this.fullScanFallback(
          input,
          'Historique Git divergent.',
        );
      }

      const files =
        data.files ?? [];

      const added:
        string[] = [];

      const modified:
        string[] = [];

      const deleted:
        string[] = [];

      const renamed:
        Array<{
          from: string;
          to: string;
        }> = [];

      for (
        const file of files
      ) {
        switch (
          file.status
        ) {
          case 'added':
            added.push(
              file.filename,
            );
            break;

          case 'removed':
            deleted.push(
              file.filename,
            );
            break;

          case 'renamed':
            if (
              file.previous_filename
            ) {
              renamed.push({
                from:
                  file.previous_filename,

                to:
                  file.filename,
              });
            } else {
              modified.push(
                file.filename,
              );
            }

            break;

          case 'modified':
          case 'changed':
          case 'copied':
            modified.push(
              file.filename,
            );
            break;

          default:
            break;
        }
      }

      return {
        repositoryId:
          input.repositoryId,

        fromSha:
          input.fromSha,

        toSha:
          input.toSha,

        added,

        modified,

        deleted,

        renamed,

        changedFileCount:
          added.length +
          modified.length +
          deleted.length +
          renamed.length,

        requiresFullScan:
          false,

        fullScanReasons:
          [],
      };
    } catch (
      error: unknown
    ) {
      return this.fullScanFallback(
        input,
        error instanceof Error
          ? `GitHub Compare indisponible : ${error.message}`
          : 'GitHub Compare indisponible.',
      );
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }

  private fullScanFallback(
    input:
      GithubCompareInput,

    reason:
      string,
  ): ChangeSet {
    return {
      repositoryId:
        input.repositoryId,

      fromSha:
        input.fromSha,

      toSha:
        input.toSha,

      added:
        [],

      modified:
        [],

      deleted:
        [],

      renamed:
        [],

      changedFileCount:
        0,

      requiresFullScan:
        true,

      fullScanReasons: [
        reason,
      ],
    };
  }
}
