import {
  Injectable,
} from '@nestjs/common';

import type {
  ChangeSet,
} from '@securecode-platform/scanner-core';

import {
  GithubCompareService,
} from './github-compare.service';

export interface ResolveChangeSetInput {
  provider:
    | 'GITHUB'
    | 'GITLAB';

  repositoryId:
    string;

  installationId:
    string | null;

  owner:
    string;

  repositoryName:
    string;

  fromSha:
    string | null;

  toSha:
    string;
}

@Injectable()
export class ChangeSetResolverService {
  constructor(
    private readonly githubCompare:
      GithubCompareService,
  ) {}

  async resolve(
    input:
      ResolveChangeSetInput,
  ): Promise<ChangeSet> {
    /*
     * Premier scan.
     */
    if (
      !input.fromSha
    ) {
      return {
        repositoryId:
          input.repositoryId,

        fromSha:
          null,

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
          'Aucun scan précédent.',
        ],
      };
    }

    if (
      input.provider ===
      'GITHUB'
    ) {
      if (
        !input.installationId
      ) {
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
            'Installation GitHub indisponible.',
          ],
        };
      }

      return this.githubCompare
        .compare({
          installationId:
            input.installationId,

          repositoryId:
            input.repositoryId,

          owner:
            input.owner,

          repositoryName:
            input.repositoryName,

          fromSha:
            input.fromSha,

          toSha:
            input.toSha,
        });
    }

    /*
     * GitLab sera ajouté par un adaptateur,
     * sans modifier le Scan Planner.
     */
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
        `Provider ${input.provider} non encore supporté pour le diff.`,
      ],
    };
  }
}
