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
  JOB_NAMES,
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';

import type {
  RepositorySyncJobData,
} from '@securecode-platform/queue-contracts';

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

  async process(
    job: Job<RepositorySyncJobData>,
  ): Promise<void> {
    if (job.name !== JOB_NAMES.SYNC_REPOSITORY) {
      throw new Error(
        `Job non pris en charge : ${job.name}`,
      );
    }

    this.logger.log(
      `Synchronisation du dépôt ${job.data.repositoryFullName}`,
    );

    this.logger.debug(
      `Commit : ${job.data.commitSha}`,
    );

    /*
     * Le téléchargement réel du dépôt sera ajouté
     * dans le prochain lot.
     *
     * Ne jamais exécuter le code récupéré.
     */

    await job.updateProgress(100);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<RepositorySyncJobData>): void {
    this.logger.log(
      `Job ${job.id ?? 'inconnu'} terminé`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(
    job: Job<RepositorySyncJobData> | undefined,
    error: Error,
  ): void {
    this.logger.error(
      `Échec du job ${job?.id ?? 'inconnu'} : ${error.message}`,
      error.stack,
    );
  }
}
