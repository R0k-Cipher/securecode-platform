import {
  Logger,
} from '@nestjs/common';

import {
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';

import {
  Job,
} from 'bullmq';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  JOB_NAMES,
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';

import type {
  RepositorySyncJobData,
} from '@securecode-platform/queue-contracts';

import {
  RepositoryWorkspaceService,
} from '../services/repository-workspace.service';
import { RepositoryDownloadService } from '../services/repository-download.service';

import {
  RepositorySyncStatus,
} from '@prisma/client';

@Processor(
  QUEUE_NAMES.REPOSITORY_SYNC,
  {
    concurrency: 2,
  },
)
export class RepositorySyncProcessor
  extends WorkerHost
{
  private readonly logger =
    new Logger(RepositorySyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceService: RepositoryWorkspaceService,
    private readonly downloadService: RepositoryDownloadService,
  ) {
    super();
  }

  async process(
    job: Job<RepositorySyncJobData>,
  ): Promise<void> {
    if (
      job.name !==
      JOB_NAMES.SYNC_REPOSITORY
    ) {
      throw new Error(
        `Job non pris en charge : ${job.name}`,
      );
    }

    const {
      organizationId,
      projectId,
      repositoryId,
      repositorySyncId,
      gitConnectionId,
      repositoryFullName,
      branch,
      commitSha,
      provider,
      correlationId,
    } = job.data;

    let workspacePath: string | null =
      null;

    try {
      this.logger.log(
        `[${correlationId}] Début synchronisation du dépôt ${repositoryFullName}`,
      );

      /*
       * Vérifier que la synchronisation existe
       * dans la bonne organisation.
       */
      const repositorySync =
        await this.prisma.repositorySync.findFirst({
          where: {
            id: repositorySyncId,
            organizationId,
            repositoryId,
          },

          select: {
            id: true,
            status: true,
          },
        });

      if (!repositorySync) {
        throw new Error(
          `RepositorySync ${repositorySyncId} introuvable.`,
        );
      }

      /*
       * Vérifier que le repository appartient
       * au bon projet / organisation / provider.
       */
      const repository =
        await this.prisma.repository.findFirst({
          where: {
            id: repositoryId,
            organizationId,
            projectId,
            gitConnectionId,
          },

          select: {
            id: true,
            provider: true,
            owner: true,
            name: true,
            fullName: true,
            defaultBranch: true,
            lastRemoteCommitSha: true,
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
        throw new Error(
          `Repository ${repositoryId} introuvable.`,
        );
      }

      if (
        repository.provider !==
        'GITHUB'
      ) {
        throw new Error(
          `Provider ${repository.provider} non encore supporté par ce worker.`,
        );
      }

      if (
        !repository.gitConnection
          .installationId
      ) {
        throw new Error(
          "La connexion GitHub ne possède pas d'installationId.",
        );
      }

      /*
       * Le prochain bloc mettra :
       * RepositorySync = RUNNING
       * Repository = RUNNING
       */

      await this.prisma.$transaction([
        this.prisma.repository.update({
          where: {
            id: repositoryId,
          },
          data: {
            syncStatus:
              RepositorySyncStatus.RUNNING,
          },
        }),

        this.prisma.repositorySync.update({
          where: {
            id: repositorySyncId,
          },
          data: {
            status:
              RepositorySyncStatus.RUNNING,

            startedAt:
              new Date(),

            attempt:
              job.attemptsMade + 1,

            queueJobId:
              job.id
                ? String(job.id)
                : null,

            errorMessage:
              null,

            failedAt:
              null,
          },
        }),
      ]);

      await job.updateProgress(10);
      /*
       * Création d'un workspace temporaire isolé.
       */
      workspacePath =
        await this.workspaceService
          .createWorkspace(
            repositorySyncId,
          );

      this.logger.debug(
        `[${correlationId}] Workspace créé : ${workspacePath}`,
      );

      await job.updateProgress(20);

    const targetRef =
        commitSha ??
        branch ??
        repository.defaultBranch;

      if (!targetRef) {
        throw new Error(
          'Aucune branche ou révision Git disponible.',
        );
      }

      const downloadResult =
        await this.downloadService
          .downloadGithubRepository({
            installationId:
              repository.gitConnection
                .installationId,

            owner:
              repository.owner,

            repositoryName:
              repository.name,

            ref:
              targetRef,

            workspacePath,
          });

      await job.updateProgress(40);

      this.logger.log(
        `Archive téléchargée pour ${repository.fullName} : ${downloadResult.sizeBytes} octets`,
      );
      /*
       * PROCHAIN LOT :
       *
       * - obtenir le token GitHub/GitLab
       * - télécharger le dépôt
       * - valider sa taille
       * - extraire de manière sécurisée
       * - scanner
       *
       * Ne jamais exécuter le code récupéré.
       */

      this.logger.debug(
        `[${correlationId}] Provider=${provider}, branche=${branch ?? 'N/A'}, commit=${commitSha ?? 'N/A'}`,
      );

    const completedAt =
      new Date();

    await this.prisma.$transaction([
      this.prisma.repository.update({
        where: {
          id: repositoryId,
        },

        data: {
          syncStatus:
            RepositorySyncStatus.COMPLETED,

          lastSyncedAt:
            completedAt,

          lastRemoteCommitSha:
            commitSha,
        },
      }),

      this.prisma.repositorySync.update({
        where: {
          id: repositorySyncId,
        },

        data: {
          status:
            RepositorySyncStatus.COMPLETED,

          completedAt,

          errorMessage:
            null,
        },
      }),
    ]);

    await job.updateProgress(100);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Erreur inconnue durant la synchronisation.';

      this.logger.error(
        `[${job.data.correlationId}] Échec de synchronisation : ${message}`,
        error instanceof Error
          ? error.stack
          : undefined,
      );

      try {
        await this.prisma.$transaction([
          this.prisma.repository.updateMany({
            where: {
              id:
                job.data.repositoryId,

              organizationId:
                job.data.organizationId,
            },

            data: {
              syncStatus:
                RepositorySyncStatus.FAILED,
            },
          }),

          this.prisma.repositorySync.updateMany({
            where: {
              id:
                job.data.repositorySyncId,

              repositoryId:
                job.data.repositoryId,

              organizationId:
                job.data.organizationId,
            },

            data: {
              status:
                RepositorySyncStatus.FAILED,

              failedAt:
                new Date(),

              errorMessage:
                message.slice(0, 2000),
            },
          }),
        ]);
      } catch (statusError: unknown) {
        this.logger.error(
          `[${job.data.correlationId}] Impossible d'enregistrer le statut FAILED.`,
          statusError instanceof Error
            ? statusError.stack
            : String(statusError),
        );
      }

      throw error;
    } finally {
      /*
       * Toujours supprimer le workspace,
       * succès ou erreur.
       */
      if (workspacePath) {
        try {
          await this.workspaceService
            .cleanupWorkspace(
              workspacePath,
            );

          this.logger.debug(
            `[${job.data.correlationId}] Workspace supprimé.`,
          );
        } catch (cleanupError: unknown) {
          this.logger.error(
            `[${job.data.correlationId}] Échec du nettoyage du workspace.`,
            cleanupError instanceof Error
              ? cleanupError.stack
              : String(cleanupError),
          );
        }
      }
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(
    job: Job<RepositorySyncJobData>,
  ): void {
    this.logger.log(
      `[${job.data.correlationId}] Job ${job.id ?? 'inconnu'} terminé.`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<RepositorySyncJobData> | undefined,
    error: Error,
  ): void {
    this.logger.error(
      `[${job?.data.correlationId ?? 'sans-correlation-id'}] Échec du job ${job?.id ?? 'inconnu'} : ${error.message}`,
      error.stack,
    );
  }
}
