import type {
  Prisma,
  Repository,
} from '@prisma/client';

import type { RepositoryResponse } from '../types/repository-response.type';

export const REPOSITORY_RESPONSE_INCLUDE = {
  gitConnection: {
    select: {
      id: true,
      provider: true,
      externalAccountId: true,
      externalAccountName: true,
      status: true,
    },
  },
  _count: {
    select: {
      commits: true,
      pullRequests: true,
      releases: true,
      webhookEvents: true,
      scans: true,
      findings: true,
    },
  },
} satisfies Prisma.RepositoryInclude;

export type RepositoryWithResponseRelations =
  Prisma.RepositoryGetPayload<{
    include: typeof REPOSITORY_RESPONSE_INCLUDE;
  }>;

export class RepositoryMapper {
  static toResponse(
    repository: Repository,
  ): RepositoryResponse {
    return {
      id: repository.id,
      projectId: repository.projectId,
      gitConnectionId: repository.gitConnectionId,
      provider: repository.provider,
      externalId: repository.externalId,
      name: repository.name,
      fullName: repository.fullName,
      cloneUrl: repository.cloneUrl,
      webUrl: repository.webUrl,
      defaultBranch: repository.defaultBranch,
      visibility: repository.visibility,
      isArchived: repository.isArchived,
      lastSyncedAt: repository.lastSyncedAt,
      createdAt: repository.createdAt,
      updatedAt: repository.updatedAt,
    };
  }

  static withRelations(
    repository: RepositoryWithResponseRelations,
  ): RepositoryResponse {
    return {
      ...this.toResponse(repository),

      gitConnection: {
        id: repository.gitConnection.id,
        provider: repository.gitConnection.provider,
        externalAccountId:
          repository.gitConnection.externalAccountId,
        externalAccountName:
          repository.gitConnection.externalAccountName,
        status: repository.gitConnection.status,
      },

      counts: {
        commits: repository._count.commits,
        pullRequests:
          repository._count.pullRequests,
        releases: repository._count.releases,
        webhookEvents:
          repository._count.webhookEvents,
        scans: repository._count.scans,
        findings: repository._count.findings,
      },
    };
  }
}
