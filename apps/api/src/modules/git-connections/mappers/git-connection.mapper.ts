import type {
  GitConnection,
  Prisma,
} from '@prisma/client';

import type { GitConnectionResponse } from '../types/git-connection-response.type';

export const GIT_CONNECTION_RESPONSE_INCLUDE = {
  connectedBy: {
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  },
  _count: {
    select: {
      repositories: true,
      webhookEvents: true,
    },
  },
} satisfies Prisma.GitConnectionInclude;

export type GitConnectionWithRelations =
  Prisma.GitConnectionGetPayload<{
    include: typeof GIT_CONNECTION_RESPONSE_INCLUDE;
  }>;

export class GitConnectionMapper {
  static toResponse(
    connection: GitConnection,
  ): GitConnectionResponse {
    return {
      id: connection.id,
      organizationId: connection.organizationId,
      connectedById: connection.connectedById,
      provider: connection.provider,
      externalAccountId: connection.externalAccountId,
      externalAccountName: connection.externalAccountName,
      tokenExpiresAt: connection.tokenExpiresAt,
      status: connection.status,
      createdAt: connection.createdAt,
      updatedAt: connection.updatedAt,
      revokedAt: connection.revokedAt,
    };
  }

  static withRelations(
    connection: GitConnectionWithRelations,
  ): GitConnectionResponse {
    return {
      ...this.toResponse(connection),

      connectedBy: connection.connectedBy,

      repositoriesCount:
        connection._count.repositories,

      webhookEventsCount:
        connection._count.webhookEvents,
    };
  }
}
