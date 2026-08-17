import type {
  ConnectionStatus,
  GitProvider,
} from '@prisma/client';

export interface GitConnectionConnectorResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface GitConnectionResponse {
  id: string;
  organizationId: string;
  connectedById: string;
  provider: GitProvider;
  externalAccountId: string;
  externalAccountName: string | null;
  tokenExpiresAt: Date | null;
  status: ConnectionStatus;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;

  connectedBy?: GitConnectionConnectorResponse;
  repositoriesCount?: number;
  webhookEventsCount?: number;
}
