import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import {
  AuditAction,
  ConnectionStatus,
  GitProvider,
  RepositorySyncStatus,
  RepositorySyncTrigger,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';

import { PrismaService } from '@securecode-platform/database';
import {
  JOB_NAMES,
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';
import type { RepositorySyncJobData } from '@securecode-platform/queue-contracts';

import { GithubClientService } from '../github-app/github-client.service';

@Injectable()
export class RepositorySyncDispatcherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly githubClient: GithubClientService,
    @InjectQueue(QUEUE_NAMES.REPOSITORY_SYNC)
    private readonly repositorySyncQueue: Queue,
  ) {}

  async requestManualSync(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    currentUserId: string,
  ) {
    const repository = await this.prisma.repository.findFirst({
      where: {
        id: repositoryId,
        organizationId,
        projectId,
      },
      select: {
        id: true,
        organizationId: true,
        projectId: true,
        gitConnectionId: true,
        provider: true,
        externalId: true,
        owner: true,
        name: true,
        fullName: true,
        defaultBranch: true,
        isArchived: true,
        gitConnection: {
          select: {
            id: true,
            provider: true,
            installationId: true,
            status: true,
          },
        },
      },
    });

    if (!repository) {
      throw new NotFoundException('Dépôt introuvable.');
    }

    if (repository.isArchived) {
      throw new ConflictException(
        'Un dépôt archivé ne peut pas être synchronisé.',
      );
    }

    if (repository.gitConnection.status !== ConnectionStatus.ACTIVE) {
      throw new ConflictException(
        'La connexion Git du dépôt n’est pas active.',
      );
    }

    if (repository.provider !== GitProvider.GITHUB) {
      throw new ConflictException(
        'La synchronisation manuelle est actuellement disponible pour GitHub uniquement.',
      );
    }

    if (!repository.gitConnection.installationId) {
      throw new ConflictException(
        "La connexion GitHub ne possède pas d'installationId.",
      );
    }

    const installationId = Number(repository.gitConnection.installationId);

    if (!Number.isSafeInteger(installationId) || installationId <= 0) {
      throw new ConflictException(
        "L'identifiant d'installation GitHub enregistré est invalide.",
      );
    }

    const branch = repository.defaultBranch;

    if (!branch) {
      throw new ConflictException(
        'Le dépôt ne possède pas de branche par défaut.',
      );
    }

    const latestCommit = await this.githubClient.getLatestCommit(
      installationId,
      repository.owner,
      repository.name,
      branch,
    );

    const correlationId = randomUUID();
    const requestedAt = new Date();

    const repositorySync = await this.prisma.$transaction(async (tx) => {
      const sync = await tx.repositorySync.create({
        data: {
          organizationId,
          repositoryId,
          triggeredById: currentUserId,
          trigger: RepositorySyncTrigger.MANUAL,
          status: RepositorySyncStatus.PENDING,
          branch,
          commitSha: latestCommit.sha,
          metadata: {
            provider: 'GITHUB',
            repositoryFullName: repository.fullName,
            correlationId,
            requestedAt: requestedAt.toISOString(),
          },
        },
      });

      await tx.repository.update({
        where: { id: repository.id },
        data: {
          syncStatus: RepositorySyncStatus.PENDING,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId,
          projectId,
          actorId: currentUserId,
          action: AuditAction.UPDATE,
          resourceType: 'Repository',
          resourceId: repository.id,
          description: `Synchronisation manuelle du dépôt "${repository.fullName}" demandée`,
          metadata: {
            repositorySyncId: sync.id,
            branch,
            commitSha: latestCommit.sha,
            correlationId,
          },
        },
      });

      return sync;
    });

    const jobData: RepositorySyncJobData = {
      organizationId,
      projectId,
      repositoryId: repository.id,
      repositorySyncId: repositorySync.id,
      gitConnectionId: repository.gitConnectionId,
      provider: 'GITHUB',
      repositoryExternalId: repository.externalId,
      repositoryFullName: repository.fullName,
      branch,
      commitSha: latestCommit.sha,
      trigger: 'MANUAL',
      eventType: null,
      eventId: null,
      triggeredById: currentUserId,
      requestedAt: requestedAt.toISOString(),
      correlationId,
    };

    try {
      const job = await this.repositorySyncQueue.add(
        JOB_NAMES.SYNC_REPOSITORY,
        jobData,
        {
          jobId: `repository-sync-${repositorySync.id}`,
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
            queueJobId: job.id ? String(job.id) : null,
          },
        }),
        this.prisma.repository.update({
          where: { id: repository.id },
          data: {
            syncStatus: RepositorySyncStatus.QUEUED,
          },
        }),
      ]);

      return {
        accepted: true,
        repositoryId: repository.id,
        repositorySyncId: repositorySync.id,
        status: RepositorySyncStatus.QUEUED,
        branch,
        commitSha: latestCommit.sha,
        queueJobId: job.id ? String(job.id) : null,
        correlationId,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Impossible de placer la synchronisation dans la file.';

      await this.prisma.$transaction([
        this.prisma.repositorySync.update({
          where: { id: repositorySync.id },
          data: {
            status: RepositorySyncStatus.FAILED,
            failedAt: new Date(),
            errorMessage: message.slice(0, 2_000),
          },
        }),
        this.prisma.repository.update({
          where: { id: repository.id },
          data: {
            syncStatus: RepositorySyncStatus.FAILED,
          },
        }),
      ]);

      throw error;
    }
  }
}
