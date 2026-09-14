import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  ConnectionStatus,
  GitProvider,
  Prisma,
  RepositorySyncStatus,
  RepositorySyncTrigger,
  ScanStatus,
  ScanTrigger,
  ScanType,
  WebhookEventStatus,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '@securecode-platform/database';
import {
  JOB_NAMES,
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';
import type {
  RepositorySyncJobData,
  SecurityScanJobData,
} from '@securecode-platform/queue-contracts';

import { GithubClientService } from './github-client.service';
import { GithubWebhookSignatureService } from './github-webhook-signature.service';
import { GithubWebhookDeduplicationService } from './github-webhook-deduplication.service';
import type {
  GithubInstallationRepositoriesWebhookPayload,
  GithubInstallationWebhookPayload,
  GithubPullRequestWebhookPayload,
  GithubPushWebhookPayload,
  GithubReleaseWebhookPayload,
} from './types/github-webhook.types';

export interface HandleGithubWebhookInput {
  signature: string;
  eventType: string;
  deliveryId: string;
  rawBody: Buffer;
  payload: unknown;
}

type ImportedGithubRepository = {
  id: string;
  organizationId: string;
  projectId: string;
  gitConnectionId: string;
  externalId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string | null;
  lastRemoteCommitSha: string | null;
  gitConnection: {
    installationId: string | null;
    status: ConnectionStatus;
  };
};

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly signatureService: GithubWebhookSignatureService,
    private readonly deduplication: GithubWebhookDeduplicationService,
    private readonly githubClient: GithubClientService,
    @InjectQueue(QUEUE_NAMES.REPOSITORY_SYNC)
    private readonly repositorySyncQueue: Queue,
    @InjectQueue(QUEUE_NAMES.SECURITY_SCAN)
    private readonly securityScanQueue: Queue,
  ) {}

  async handle(input: HandleGithubWebhookInput) {
    this.signatureService.verify(
      input.rawBody,
      input.signature,
    );

    if (
      await this.deduplication.alreadyProcessed(
        input.deliveryId,
      )
    ) {
      return {
        accepted: true,
        duplicate: true,
      };
    }

    const event = await this.prepareEvent(input);

    try {
      const result = await this.dispatch(input);

      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status:
            'ignored' in result && result.ignored
              ? WebhookEventStatus.IGNORED
              : WebhookEventStatus.PROCESSED,
          processedAt: new Date(),
          errorMessage:
            'reason' in result && result.reason
              ? String(result.reason)
              : null,
        },
      });

      return result;
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erreur inconnue durant le traitement du webhook GitHub.';

      await this.prisma.webhookEvent.updateMany({
        where: { id: event.id },
        data: {
          status: WebhookEventStatus.FAILED,
          errorMessage: message.slice(0, 2_000),
        },
      });

      this.logger.error(
        `[GitHub webhook ${input.deliveryId}] ${message}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw error;
    }
  }

  private async dispatch(
    input: HandleGithubWebhookInput,
  ): Promise<Record<string, unknown>> {
    switch (input.eventType) {
      case 'push':
        return this.handlePush(input);

      case 'pull_request':
        return this.handlePullRequest(input);

      case 'release':
        return this.handleRelease(input);

      case 'installation':
        return this.handleInstallation(input);

      case 'installation_repositories':
        return this.handleInstallationRepositories(input);

      case 'ping':
        return {
          accepted: true,
          event: 'ping',
        };

      default:
        return {
          accepted: true,
          ignored: true,
          reason: `UNSUPPORTED_EVENT_${input.eventType}`,
        };
    }
  }

  private async prepareEvent(
    input: HandleGithubWebhookInput,
  ) {
    return this.prisma.webhookEvent.upsert({
      where: {
        provider_deliveryId: {
          provider: GitProvider.GITHUB,
          deliveryId: input.deliveryId,
        },
      },
      create: {
        provider: GitProvider.GITHUB,
        deliveryId: input.deliveryId,
        externalEventId: input.deliveryId,
        eventType: input.eventType,
        signatureValid: true,
        status: WebhookEventStatus.VERIFIED,
        payload: input.payload as Prisma.InputJsonValue,
        processingAttempts: 1,
      },
      update: {
        eventType: input.eventType,
        signatureValid: true,
        status: WebhookEventStatus.VERIFIED,
        payload: input.payload as Prisma.InputJsonValue,
        errorMessage: null,
        processedAt: null,
        processingAttempts: {
          increment: 1,
        },
      },
      select: {
        id: true,
      },
    });
  }

  private async attachEventToRepository(
    deliveryId: string,
    repository: ImportedGithubRepository,
  ): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: {
        provider_deliveryId: {
          provider: GitProvider.GITHUB,
          deliveryId,
        },
      },
      data: {
        repositoryId: repository.id,
        gitConnectionId: repository.gitConnectionId,
        status: WebhookEventStatus.PROCESSING,
      },
    });
  }

  private async handlePush(
    input: HandleGithubWebhookInput,
  ) {
    const payload = input.payload as GithubPushWebhookPayload;

    if (payload.deleted || this.isZeroSha(payload.after)) {
      return {
        accepted: true,
        ignored: true,
        reason: 'DELETED_BRANCH_OR_ZERO_SHA',
      };
    }

    const branch = this.extractBranch(payload.ref);
    const repository = await this.findRepository(
      String(payload.repository.id),
    );

    if (!repository) {
      return {
        accepted: true,
        ignored: true,
        reason: 'REPOSITORY_NOT_IMPORTED',
      };
    }

    if (repository.gitConnection.status !== ConnectionStatus.ACTIVE) {
      return {
        accepted: true,
        ignored: true,
        reason: 'GIT_CONNECTION_NOT_ACTIVE',
      };
    }

    if (branch !== repository.defaultBranch) {
      return {
        accepted: true,
        ignored: true,
        reason: 'NON_DEFAULT_BRANCH',
      };
    }

    await this.attachEventToRepository(
      input.deliveryId,
      repository,
    );

    const correlationId = randomUUID();

    const repositorySync =
      await this.getOrCreateWebhookRepositorySync(
        repository,
        input.deliveryId,
        branch,
        payload.after,
        {
          eventType: 'PUSH',
          before: payload.before,
          forced: payload.forced,
          correlationId,
        },
      );

    if (!repositorySync.queueJobId) {
      const syncJobData: RepositorySyncJobData = {
        organizationId: repository.organizationId,
        projectId: repository.projectId,
        repositoryId: repository.id,
        repositorySyncId: repositorySync.id,
        gitConnectionId: repository.gitConnectionId,
        provider: 'GITHUB',
        repositoryExternalId: repository.externalId,
        repositoryFullName: repository.fullName,
        branch,
        commitSha: payload.after,
        trigger: 'WEBHOOK',
        eventType: 'PUSH',
        eventId: input.deliveryId,
        triggeredById: null,
        requestedAt: new Date().toISOString(),
        correlationId,
      };

      const syncJob = await this.repositorySyncQueue.add(
        JOB_NAMES.SYNC_REPOSITORY,
        syncJobData,
        {
          jobId: `github-push-sync-${input.deliveryId}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5_000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      await this.prisma.$transaction([
        this.prisma.repositorySync.update({
          where: { id: repositorySync.id },
          data: {
            status: RepositorySyncStatus.QUEUED,
            queueJobId: syncJob.id ? String(syncJob.id) : null,
          },
        }),
        this.prisma.repository.update({
          where: { id: repository.id },
          data: {
            syncStatus: RepositorySyncStatus.QUEUED,
          },
        }),
      ]);
    }

    const scan = await this.getOrCreateScanForDelivery(
      repository,
      input.deliveryId,
      ScanTrigger.PUSH,
      {
        type: ScanType.INCREMENTAL_SCAN,
        branch,
        commitSha: payload.after,
        configuration: {
          eventId: input.deliveryId,
          requestedMode: payload.forced ? 'FULL' : 'AUTO',
          beforeSha: payload.before,
          forced: payload.forced,
          correlationId,
        },
      },
    );

    if (!scan.queueJobId) {
      const scanJobData: SecurityScanJobData = {
        organizationId: repository.organizationId,
        projectId: repository.projectId,
        repositoryId: repository.id,
        scanId: scan.id,
        gitConnectionId: repository.gitConnectionId,
        provider: 'GITHUB',
        repositoryExternalId: repository.externalId,
        repositoryFullName: repository.fullName,
        branch,
        fromSha: this.isZeroSha(payload.before)
          ? null
          : payload.before,
        toSha: payload.after,
        pullRequestId: null,
        requestedMode: payload.forced ? 'FULL' : 'AUTO',
        trigger: 'PUSH',
        triggeredById: null,
        eventId: input.deliveryId,
        requestedAt: new Date().toISOString(),
        correlationId,
      };

      const queueJob = await this.securityScanQueue.add(
        JOB_NAMES.SECURITY_SCAN,
        scanJobData,
        {
          jobId: `github-push-scan-${input.deliveryId}`,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5_000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      await this.prisma.scan.update({
        where: { id: scan.id },
        data: {
          queueJobId: queueJob.id ? String(queueJob.id) : null,
        },
      });
    }

    return {
      accepted: true,
      duplicate: false,
      event: 'push',
      repositoryId: repository.id,
      repositorySyncId: repositorySync.id,
      scanId: scan.id,
    };
  }

  private async handlePullRequest(
    input: HandleGithubWebhookInput,
  ) {
    const payload = input.payload as GithubPullRequestWebhookPayload;
    const supportedActions = new Set([
      'opened',
      'synchronize',
      'reopened',
    ]);

    if (!supportedActions.has(payload.action)) {
      return {
        accepted: true,
        ignored: true,
        reason: `PR_ACTION_${payload.action}`,
      };
    }

    const repository = await this.findRepository(
      String(payload.repository.id),
    );

    if (!repository) {
      return {
        accepted: true,
        ignored: true,
        reason: 'REPOSITORY_NOT_IMPORTED',
      };
    }

    if (repository.gitConnection.status !== ConnectionStatus.ACTIVE) {
      return {
        accepted: true,
        ignored: true,
        reason: 'GIT_CONNECTION_NOT_ACTIVE',
      };
    }

    await this.attachEventToRepository(
      input.deliveryId,
      repository,
    );

    const correlationId = randomUUID();
    const headSha = payload.pull_request.head.sha;
    const baseSha = payload.pull_request.base.sha;

    const scan = await this.getOrCreateScanForDelivery(
      repository,
      input.deliveryId,
      ScanTrigger.PULL_REQUEST,
      {
        type: ScanType.PULL_REQUEST_SCAN,
        branch: payload.pull_request.head.ref,
        commitSha: headSha,
        configuration: {
          eventId: input.deliveryId,
          pullRequestExternalId: payload.pull_request.id,
          pullRequestNumber: payload.number,
          baseSha,
          headSha,
          requestedMode: 'PULL_REQUEST',
          correlationId,
        },
      },
    );

    if (!scan.queueJobId) {
      const jobData: SecurityScanJobData = {
        organizationId: repository.organizationId,
        projectId: repository.projectId,
        repositoryId: repository.id,
        scanId: scan.id,
        gitConnectionId: repository.gitConnectionId,
        provider: 'GITHUB',
        repositoryExternalId: repository.externalId,
        repositoryFullName: repository.fullName,
        branch: payload.pull_request.head.ref,
        fromSha: baseSha,
        toSha: headSha,
        pullRequestId: String(payload.pull_request.id),
        requestedMode: 'PULL_REQUEST',
        trigger: 'PULL_REQUEST',
        triggeredById: null,
        eventId: input.deliveryId,
        requestedAt: new Date().toISOString(),
        correlationId,
      };

      const queueJob = await this.securityScanQueue.add(
        JOB_NAMES.SECURITY_SCAN,
        jobData,
        {
          jobId: `github-pr-scan-${input.deliveryId}`,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5_000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      await this.prisma.scan.update({
        where: { id: scan.id },
        data: {
          queueJobId: queueJob.id ? String(queueJob.id) : null,
        },
      });
    }

    return {
      accepted: true,
      event: 'pull_request',
      scanId: scan.id,
      pullRequest: payload.number,
    };
  }

  private async handleRelease(
    input: HandleGithubWebhookInput,
  ) {
    const payload = input.payload as GithubReleaseWebhookPayload;

    if (payload.action !== 'published' || payload.release.draft) {
      return {
        accepted: true,
        ignored: true,
        reason: `RELEASE_ACTION_${payload.action}`,
      };
    }

    const repository = await this.findRepository(
      String(payload.repository.id),
    );

    if (!repository) {
      return {
        accepted: true,
        ignored: true,
        reason: 'REPOSITORY_NOT_IMPORTED',
      };
    }

    if (repository.gitConnection.status !== ConnectionStatus.ACTIVE) {
      return {
        accepted: true,
        ignored: true,
        reason: 'GIT_CONNECTION_NOT_ACTIVE',
      };
    }

    const installationId = this.parseInstallationId(
      repository.gitConnection.installationId,
    );

    const targetSha = await this.githubClient.resolveCommitSha(
      installationId,
      repository.owner,
      repository.name,
      payload.release.tag_name,
    );

    await this.attachEventToRepository(
      input.deliveryId,
      repository,
    );

    const correlationId = randomUUID();
    const requestedMode = payload.release.prerelease
      ? 'AUTO'
      : 'FULL';

    const scan = await this.getOrCreateScanForDelivery(
      repository,
      input.deliveryId,
      ScanTrigger.RELEASE,
      {
        type: ScanType.RELEASE_SCAN,
        branch:
          payload.release.target_commitish ||
          repository.defaultBranch ||
          payload.release.tag_name,
        commitSha: targetSha,
        configuration: {
          eventId: input.deliveryId,
          releaseExternalId: payload.release.id,
          tag: payload.release.tag_name,
          prerelease: payload.release.prerelease,
          requestedMode,
          resolvedTagSha: targetSha,
          correlationId,
        },
      },
    );

    if (!scan.queueJobId) {
      const jobData: SecurityScanJobData = {
        organizationId: repository.organizationId,
        projectId: repository.projectId,
        repositoryId: repository.id,
        scanId: scan.id,
        gitConnectionId: repository.gitConnectionId,
        provider: 'GITHUB',
        repositoryExternalId: repository.externalId,
        repositoryFullName: repository.fullName,
        branch:
          payload.release.target_commitish ||
          repository.defaultBranch ||
          payload.release.tag_name,
        fromSha: null,
        toSha: targetSha,
        pullRequestId: null,
        requestedMode,
        trigger: 'RELEASE',
        triggeredById: null,
        eventId: input.deliveryId,
        requestedAt: new Date().toISOString(),
        correlationId,
      };

      const queueJob = await this.securityScanQueue.add(
        JOB_NAMES.SECURITY_SCAN,
        jobData,
        {
          jobId: `github-release-scan-${input.deliveryId}`,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 10_000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      );

      await this.prisma.scan.update({
        where: { id: scan.id },
        data: {
          queueJobId: queueJob.id ? String(queueJob.id) : null,
        },
      });
    }

    return {
      accepted: true,
      event: 'release',
      repositoryId: repository.id,
      scanId: scan.id,
      tag: payload.release.tag_name,
      commitSha: targetSha,
    };
  }

  private async handleInstallation(
    input: HandleGithubWebhookInput,
  ) {
    const payload = input.payload as GithubInstallationWebhookPayload;
    const installationId = String(payload.installation.id);

    const connection = await this.prisma.gitConnection.findFirst({
      where: {
        provider: GitProvider.GITHUB,
        installationId,
      },
      select: {
        id: true,
        organizationId: true,
      },
    });

    if (!connection) {
      return {
        accepted: true,
        ignored: true,
        reason: 'INSTALLATION_NOT_CONNECTED',
      };
    }

    await this.prisma.webhookEvent.update({
      where: {
        provider_deliveryId: {
          provider: GitProvider.GITHUB,
          deliveryId: input.deliveryId,
        },
      },
      data: {
        gitConnectionId: connection.id,
        status: WebhookEventStatus.PROCESSING,
      },
    });

    switch (payload.action) {
      case 'deleted':
        await this.prisma.$transaction([
          this.prisma.gitConnection.update({
            where: { id: connection.id },
            data: {
              status: ConnectionStatus.REVOKED,
              revokedAt: new Date(),
            },
          }),
          this.prisma.repository.updateMany({
            where: {
              gitConnectionId: connection.id,
            },
            data: {
              syncStatus: RepositorySyncStatus.FAILED,
            },
          }),
        ]);
        break;

      case 'suspend':
        await this.prisma.gitConnection.update({
          where: { id: connection.id },
          data: {
            status: ConnectionStatus.ERROR,
          },
        });
        break;

      case 'unsuspend':
        await this.prisma.gitConnection.update({
          where: { id: connection.id },
          data: {
            status: ConnectionStatus.ACTIVE,
            revokedAt: null,
          },
        });
        break;

      case 'created':
        break;

      default:
        return {
          accepted: true,
          ignored: true,
          reason: `INSTALLATION_ACTION_${payload.action}`,
        };
    }

    return {
      accepted: true,
      event: 'installation',
      action: payload.action,
      gitConnectionId: connection.id,
    };
  }

  private async handleInstallationRepositories(
    input: HandleGithubWebhookInput,
  ) {
    const payload =
      input.payload as GithubInstallationRepositoriesWebhookPayload;
    const installationId = String(payload.installation.id);

    const connection = await this.prisma.gitConnection.findFirst({
      where: {
        provider: GitProvider.GITHUB,
        installationId,
      },
      select: {
        id: true,
      },
    });

    if (!connection) {
      return {
        accepted: true,
        ignored: true,
        reason: 'INSTALLATION_NOT_CONNECTED',
      };
    }

    await this.prisma.webhookEvent.update({
      where: {
        provider_deliveryId: {
          provider: GitProvider.GITHUB,
          deliveryId: input.deliveryId,
        },
      },
      data: {
        gitConnectionId: connection.id,
        status: WebhookEventStatus.PROCESSING,
      },
    });

    const addedIds = (payload.repositories_added ?? []).map(
      (repository) => String(repository.id),
    );
    const removedIds = (payload.repositories_removed ?? []).map(
      (repository) => String(repository.id),
    );

    if (removedIds.length > 0) {
      await this.prisma.repository.updateMany({
        where: {
          gitConnectionId: connection.id,
          externalId: {
            in: removedIds,
          },
        },
        data: {
          syncStatus: RepositorySyncStatus.FAILED,
        },
      });
    }

    if (addedIds.length > 0) {
      await this.prisma.repository.updateMany({
        where: {
          gitConnectionId: connection.id,
          externalId: {
            in: addedIds,
          },
        },
        data: {
          syncStatus: RepositorySyncStatus.NOT_SYNCED,
        },
      });
    }

    return {
      accepted: true,
      event: 'installation_repositories',
      action: payload.action,
      added: addedIds.length,
      removed: removedIds.length,
    };
  }

  private async findRepository(
    externalId: string,
  ): Promise<ImportedGithubRepository | null> {
    return this.prisma.repository.findFirst({
      where: {
        provider: GitProvider.GITHUB,
        externalId,
        isArchived: false,
      },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        gitConnectionId: true,
        externalId: true,
        owner: true,
        name: true,
        fullName: true,
        defaultBranch: true,
        lastRemoteCommitSha: true,
        gitConnection: {
          select: {
            installationId: true,
            status: true,
          },
        },
      },
    });
  }

  private async getOrCreateWebhookRepositorySync(
    repository: ImportedGithubRepository,
    deliveryId: string,
    branch: string,
    commitSha: string,
    metadata: Record<string, unknown>,
  ) {
    const recentSyncs = await this.prisma.repositorySync.findMany({
      where: {
        organizationId: repository.organizationId,
        repositoryId: repository.id,
        trigger: RepositorySyncTrigger.WEBHOOK,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    const existing = recentSyncs.find(
      (sync) => this.readJsonString(sync.metadata, 'eventId') === deliveryId,
    );

    if (existing) {
      return existing;
    }

    return this.prisma.repositorySync.create({
      data: {
        organizationId: repository.organizationId,
        repositoryId: repository.id,
        triggeredById: null,
        trigger: RepositorySyncTrigger.WEBHOOK,
        status: RepositorySyncStatus.PENDING,
        branch,
        commitSha,
        metadata: {
          ...metadata,
          eventId: deliveryId,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private async getOrCreateScanForDelivery(
    repository: ImportedGithubRepository,
    deliveryId: string,
    trigger: ScanTrigger,
    input: {
      type: ScanType;
      branch: string;
      commitSha: string;
      configuration: Prisma.InputJsonValue;
    },
  ) {
    const recentScans = await this.prisma.scan.findMany({
      where: {
        repositoryId: repository.id,
        projectId: repository.projectId,
        trigger,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
      select: {
        id: true,
        queueJobId: true,
        configuration: true,
      },
    });

    const existing = recentScans.find(
      (scan) =>
        this.readJsonString(scan.configuration, 'eventId') === deliveryId,
    );

    if (existing) {
      return existing;
    }

    return this.prisma.scan.create({
      data: {
        projectId: repository.projectId,
        repositoryId: repository.id,
        type: input.type,
        trigger,
        status: ScanStatus.QUEUED,
        branch: input.branch,
        commitSha: input.commitSha,
        progress: 0,
        configuration: input.configuration,
      },
      select: {
        id: true,
        queueJobId: true,
        configuration: true,
      },
    });
  }

  private readJsonString(
    value: Prisma.JsonValue | null,
    key: string,
  ): string | null {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return null;
    }

    const candidate = (value as Record<string, Prisma.JsonValue>)[key];
    return typeof candidate === 'string' ? candidate : null;
  }

  private extractBranch(ref: string): string {
    const prefix = 'refs/heads/';
    return ref.startsWith(prefix)
      ? ref.slice(prefix.length)
      : ref;
  }

  private isZeroSha(sha: string): boolean {
    return /^0{40}$/.test(sha);
  }

  private parseInstallationId(
    installationId: string | null,
  ): number {
    if (!installationId) {
      throw new Error(
        "La connexion GitHub ne possède pas d'installationId.",
      );
    }

    const value = Number(installationId);

    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(
        "L'identifiant d'installation GitHub est invalide.",
      );
    }

    return value;
  }
}
