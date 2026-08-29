import {
  Injectable,
  Logger,
} from '@nestjs/common';

import {
  InjectQueue,
} from '@nestjs/bullmq';

import {
  GitProvider,
  RepositorySyncStatus,
  RepositorySyncTrigger,
  ScanStatus,
  ScanTrigger,
  ScanType,
} from '@prisma/client';

import type {
  Queue,
} from 'bullmq';

import {
  randomUUID,
} from 'node:crypto';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  JOB_NAMES,
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';

import type {
  RepositorySyncJobData,
  SecurityScanJobData,
} from '@securecode-platform/queue-contracts';

import {
  GithubWebhookSignatureService,
} from './github-webhook-signature.service';

import {
  GithubWebhookDeduplicationService,
} from './github-webhook-deduplication.service';

import type {
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

@Injectable()
export class GithubWebhookService {
  private readonly logger =
    new Logger(
      GithubWebhookService.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly signatureService:
      GithubWebhookSignatureService,

    private readonly deduplication:
      GithubWebhookDeduplicationService,

    @InjectQueue(
      QUEUE_NAMES
        .REPOSITORY_SYNC,
    )
    private readonly repositorySyncQueue:
      Queue,

    @InjectQueue(
      QUEUE_NAMES
        .SECURITY_SCAN,
    )
    private readonly securityScanQueue:
      Queue,
  ) {}

/*
  * Gestion des événements push.
  @Injectable()
  export class GithubWebhookService {

    constructor(...) {}

    async handle(...) {
      ...
    }

    private async handlePush(...) {
      ...
    }

    private async handlePullRequest(...) {
      ...
    }

    private async handleRelease(...) {
      ...
    }

    private async findRepository(...) {
      ...
    }

    private extractBranch(...) {
      ...
    }

    private isZeroSha(...) {
      ...
    }

    private async recordIgnoredEvent(...) {
      ...
    }
  }

  */


  async handle(
    input:
      HandleGithubWebhookInput,
  ) {
    /*
     * 1. Signature.
     */
    this.signatureService
      .verify(
        input.rawBody,
        input.signature,
      );

    /*
     * 2. Deduplication.
     */
    if (
      await this.deduplication
        .alreadyProcessed(
          input.deliveryId,
        )
    ) {
      return {
        accepted:
          true,

        duplicate:
          true,
      };
    }

    switch (
      input.eventType
    ) {
      case 'push':
        return this.handlePush(
          input,
        );

      case 'pull_request':
        return this.handlePullRequest(
          input,
        );

      case 'release':
        return this.handleRelease(
          input,
        );

      case 'ping':
        return {
          accepted:
            true,

          event:
            'ping',
        };

      default:
        await this.recordIgnoredEvent(
          input,
        );

        return {
          accepted:
            true,

          ignored:
            true,

          event:
            input.eventType,
        };
    }
  }

  private async handlePush(
    input:
      HandleGithubWebhookInput,
  ) {
    const payload =
      input.payload as
        GithubPushWebhookPayload;

    if (
      !payload.repository ||
      !payload.after
    ) {
      throw new Error(
        'Payload push GitHub invalide.',
      );
    }

    /*
    * Branch delete.
    */
    if (
      payload.deleted ||
      this.isZeroSha(
        payload.after,
      )
    ) {
      await this.recordIgnoredEvent(
        input,
      );

      return {
        accepted:
          true,

        ignored:
          true,

        reason:
          'BRANCH_DELETED',
      };
    }

    const branch =
      this.extractBranch(
        payload.ref,
      );

    const repository =
      await this.findRepository(
        String(
          payload.repository.id,
        ),
      );

    if (!repository) {
      await this.recordIgnoredEvent(
        input,
      );

      return {
        accepted:
          true,

        ignored:
          true,

        reason:
          'REPOSITORY_NOT_IMPORTED',
      };
    }

    /*
    * On peut décider de ne scanner que
    * la branche par défaut automatiquement.
    */
    if (
      branch !==
      repository.defaultBranch
    ) {
      await this.recordIgnoredEvent(
        input,
      );

      return {
        accepted:
          true,

        ignored:
          true,

        reason:
          'NON_DEFAULT_BRANCH',
      };
    }



    const correlationId =
      randomUUID();

    const transactionResult =
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            const webhookEvent =
              await transaction
                .webhookEvent
                .create({
                  data: {
                    provider:
                      GitProvider.GITHUB,

                    eventId:
                      input.deliveryId,

                    eventType:
                      'push',

                    repositoryId:
                      repository.id,

                    payload:
                      payload as never,
                  },
                });

            const repositorySync =
              await transaction
                .repositorySync
                .create({
                  data: {
                    organizationId:
                      repository
                        .organizationId,

                    projectId:
                      repository
                        .projectId,

                    repositoryId:
                      repository.id,

                    triggeredById:
                      null,

                    trigger:
                      RepositorySyncTrigger
                        .WEBHOOK,

                    status:
                      RepositorySyncStatus
                        .PENDING,

                    branch,

                    commitSha:
                      payload.after,

                    metadata: {
                      eventType:
                        'PUSH',

                      eventId:
                        input.deliveryId,

                      before:
                        payload.before,

                      forced:
                        payload.forced,

                      correlationId,
                    },
                  },
                });

            return {
              webhookEvent,

              repositorySync,
            };
          },
        );

    const jobData:
      RepositorySyncJobData = {
      organizationId:
        repository.organizationId,

      projectId:
        repository.projectId,

      repositoryId:
        repository.id,

      repositorySyncId:
        transactionResult
          .repositorySync
          .id,

      gitConnectionId:
        repository
          .gitConnectionId,

      provider:
        'GITHUB',

      repositoryExternalId:
        repository.externalId,

      repositoryFullName:
        repository.fullName,

      branch,

      commitSha:
        payload.after,

      trigger:
        'WEBHOOK',

      eventType:
        'PUSH',

      eventId:
        input.deliveryId,

      triggeredById:
        null,

      requestedAt:
        new Date()
          .toISOString(),

      correlationId,
    };

    await this.repositorySyncQueue
      .add(
        JOB_NAMES
          .SYNC_REPOSITORY,

        jobData,

        {
          jobId: `github-push-sync-${input.deliveryId}`,

          attempts:
            3,

          backoff: {
            type:
              'exponential',

            delay:
              5_000,
          },

          removeOnComplete:
            100,

          removeOnFail:
            500,
        },
      );

    /*
    * Scan automatique.
    *
    * Nous créons le scan directement.
    */
    const scan =
      await this.prisma
        .scan
        .create({
          data: {
            projectId:
              repository.projectId,

            repositoryId:
              repository.id,

            type:
              ScanType.INCREMENTAL_SCAN,

            trigger:
              ScanTrigger.PUSH,

            status:
              ScanStatus.QUEUED,

            branch,

            commitSha:
              payload.after,

            progress:
              0,

            configuration: {
              eventId:
                input.deliveryId,

              requestedMode:
                'AUTO',

              correlationId,

              beforeSha:
                payload.before,

              forced:
                payload.forced,
            },
          },
        });

    const scanJob: SecurityScanJobData = {
      organizationId:
        repository.organizationId,

      projectId:
        repository.projectId,

      repositoryId:
        repository.id,

      scanId:
        scan.id,

      gitConnectionId:
        repository.gitConnectionId,

      provider:
        'GITHUB',

      repositoryExternalId:
        repository.externalId,

      repositoryFullName:
        repository.fullName,

      branch,

      fromSha:
        this.isZeroSha(
          payload.before,
        )
          ? null
          : payload.before,

      toSha:
        payload.after,

      pullRequestId:
        null,

      requestedMode:
        payload.forced
          ? 'FULL'
          : 'AUTO',

      trigger: 'PUSH',

      triggeredById:
        null,

      eventId:
        input.deliveryId,

      requestedAt:
        new Date()
          .toISOString(),

      correlationId,
    };

    const queueJob =
      await this.securityScanQueue
        .add(
          JOB_NAMES
            .SECURITY_SCAN,

          scanJob,

          {
            jobId: `github-push-scan-${input.deliveryId}`,

            attempts:
              2,

            backoff: {
              type:
                'exponential',

              delay:
                5_000,
            },

            removeOnComplete:
              100,

            removeOnFail:
              500,
          },
        );

    await this.prisma
      .scan
      .update({
        where: {
          id:
            scan.id,
        },

        data: {
          queueJobId:
            queueJob.id
              ? String(
                  queueJob.id,
                )
              : null,
        },
      });

    return {
      accepted:
        true,

      duplicate:
        false,

      event:
        'push',

      repositoryId:
        repository.id,

      scanId:
        scan.id,
    };
  }

  private async handlePullRequest(
    input:
      HandleGithubWebhookInput,
  ) {
    const payload =
      input.payload as
        GithubPullRequestWebhookPayload;

    const supportedActions =
      new Set([
        'opened',
        'synchronize',
        'reopened',
      ]);

    if (
      !supportedActions.has(
        payload.action,
      )
    ) {
      await this.recordIgnoredEvent(
        input,
      );

      return {
        accepted:
          true,

        ignored:
          true,

        reason:
          `PR_ACTION_${payload.action}`,
      };
    }

    const repository =
      await this.findRepository(
        String(
          payload.repository.id,
        ),
      );

    if (!repository) {
      await this.recordIgnoredEvent(
        input,
      );

      return {
        accepted:
          true,

        ignored:
          true,

        reason:
          'REPOSITORY_NOT_IMPORTED',
      };
    }

    const correlationId =
      randomUUID();

    const webhookEvent =
      await this.prisma
        .webhookEvent
        .create({
          data: {
            provider:
              GitProvider.GITHUB,

            eventId:
              input.deliveryId,

            eventType:
              'pull_request',

            repositoryId:
              repository.id,

            payload:
              payload as never,
          },
        });

    const scan =
      await this.prisma
        .scan
        .create({
          data: {
            projectId:
              repository.projectId,

            repositoryId:
              repository.id,

            type:
              ScanType.PULL_REQUEST_SCAN,

            trigger:
              ScanTrigger.PULL_REQUEST,

            status:
              ScanStatus.QUEUED,

            branch:
              payload
                .pull_request
                .head
                .ref,

            commitSha:
              payload
                .pull_request
                .head
                .sha,

            progress:
              0,

            configuration: {
              webhookEventId:
                webhookEvent.id,

              eventId:
                input.deliveryId,

              pullRequestNumber:
                payload.number,

              baseSha:
                payload
                  .pull_request
                  .base
                  .sha,

              headSha:
                payload
                  .pull_request
                  .head
                  .sha,

              correlationId,
            },
          },
        });

    const jobData:
      SecurityScanJobData = {
      organizationId:
        repository
          .organizationId,

      projectId:
        repository
          .projectId,

      repositoryId:
        repository.id,

      scanId:
        scan.id,

      gitConnectionId:
        repository
          .gitConnectionId,

      provider:
        'GITHUB',

      repositoryExternalId:
        repository.externalId,

      repositoryFullName:
        repository.fullName,

      branch:
        payload
          .pull_request
          .head
          .ref,

      fromSha:
        payload
          .pull_request
          .base
          .sha,

      toSha:
        payload
          .pull_request
          .head
          .sha,

      pullRequestId:
        String(
          payload
            .pull_request
            .id,
        ),

      requestedMode:
        'PULL_REQUEST',

      triggeredById:
        null,

      trigger: 'PULL_REQUEST',

      eventId:
        input.deliveryId,

      requestedAt:
        new Date()
          .toISOString(),

      correlationId,
    };

    const queueJob =
      await this.securityScanQueue
        .add(
          JOB_NAMES.SECURITY_SCAN,
          jobData,
          {
            jobId: `github-pr-scan-${input.deliveryId}`,

            attempts:
              2,

            backoff: {
              type:
                'exponential',

              delay:
                5_000,
            },

            removeOnComplete:
              100,

            removeOnFail:
              500,
          },
        );

    await this.prisma
      .scan
      .update({
        where: {
          id:
            scan.id,
        },

        data: {
          queueJobId:
            queueJob.id
              ? String(
                  queueJob.id,
                )
              : null,
        },
      });

    return {
      accepted:
        true,

      event:
        'pull_request',

      scanId:
        scan.id,

      pullRequest:
        payload.number,
    };
  }

  private async handleRelease(
    input:
      HandleGithubWebhookInput,
  ) {
    const payload =
      input.payload as
        GithubReleaseWebhookPayload;

    if (
      payload.action !==
        'published'
    ) {
      await this.recordIgnoredEvent(
        input,
      );

      return {
        accepted:
          true,

        ignored:
          true,
      };
    }

    const repository =
      await this.findRepository(
        String(
          payload.repository.id,
        ),
      );

    if (!repository) {
      await this.recordIgnoredEvent(
        input,
      );

      return {
        accepted:
          true,

        ignored:
          true,

        reason:
          'REPOSITORY_NOT_IMPORTED',
      };
    }

    /*
    * Pour le premier lot Release :
    * utiliser le dernier SHA synchronisé.
    *
    * Plus tard :
    * résoudre précisément le tag → commit SHA.
    */
    const targetSha =
      repository
        .lastRemoteCommitSha;

    if (!targetSha) {
      await this.recordIgnoredEvent(
        input,
      );

      return {
        accepted:
          true,

        ignored:
          true,

        reason:
          'UNKNOWN_RELEASE_SHA',
      };
    }

    const correlationId =
      randomUUID();

    await this.prisma
      .webhookEvent
      .create({
        data: {
          provider:
            GitProvider.GITHUB,

          eventId:
            input.deliveryId,

          eventType:
            'release',

          repositoryId:
            repository.id,

          payload:
            payload as never,
        },
      });

    const scan =
      await this.prisma
        .scan
        .create({
          data: {
            projectId:
              repository.projectId,

            repositoryId:
              repository.id,

            type:
              ScanType.RELEASE_SCAN,

            trigger:
              ScanTrigger.RELEASE,

            status:
              ScanStatus.QUEUED,

            branch:
              payload.release
                .target_commitish,

            commitSha:
              targetSha,

            releaseId:
              null,

            progress:
              0,

            configuration: {
              releaseExternalId:
                payload
                  .release
                  .id,

              tag:
                payload
                  .release
                  .tag_name,

              prerelease:
                payload
                  .release
                  .prerelease,

              requestedMode:
                payload
                  .release
                  .prerelease
                  ? 'AUTO'
                  : 'FULL',

              correlationId,
            },
          },
        });

    const jobData:
      SecurityScanJobData = {
      organizationId:
        repository.organizationId,

      projectId:
        repository.projectId,

      repositoryId:
        repository.id,

      scanId:
        scan.id,

      gitConnectionId:
        repository
          .gitConnectionId,

      provider:
        'GITHUB',

      repositoryExternalId:
        repository.externalId,

      repositoryFullName:
        repository.fullName,

      branch:
        payload.release
          .target_commitish,

      fromSha:
        null,

      toSha:
        targetSha,

      pullRequestId:
        null,

      requestedMode:
        payload.release
          .prerelease
          ? 'AUTO'
          : 'FULL',

      trigger: 'RELEASE',

      triggeredById:
        null,

      eventId:
        input.deliveryId,

      requestedAt:
        new Date()
          .toISOString(),

      correlationId,
    };

    const queueJob =
      await this.securityScanQueue
        .add(
          JOB_NAMES.SECURITY_SCAN,
          jobData,
          {
            jobId: `github-release-scan-${input.deliveryId}`,

            attempts:
              2,

            backoff: {
              type:
                'exponential',

              delay:
                10_000,
            },

            removeOnComplete:
              100,

            removeOnFail:
              500,
          },
        );

    await this.prisma
      .scan
      .update({
        where: {
          id:
            scan.id,
        },

        data: {
          queueJobId:
            queueJob.id
              ? String(
                  queueJob.id,
                )
              : null,
        },
      });

    return {
      accepted:
        true,

      event:
        'release',

      scanId:
        scan.id,
    };
  }

  private async findRepository(
    externalId:
      string,
  ) {
    return this.prisma
      .repository
      .findFirst({
        where: {
          provider:
            GitProvider.GITHUB,

          externalId,

          isArchived:
            false,
        },

        select: {
          id:
            true,

          organizationId:
            true,

          projectId:
            true,

          gitConnectionId:
            true,

          externalId:
            true,

          fullName:
            true,

          defaultBranch:
            true,

          lastRemoteCommitSha:
            true,
        },
      });
  }

  private extractBranch(
    ref:
      string,
  ): string {
    const prefix =
      'refs/heads/';

    return ref.startsWith(
      prefix,
    )
      ? ref.slice(
          prefix.length,
        )
      : ref;
  }

  private isZeroSha(
    sha:
      string,
  ): boolean {
    return /^0{40}$/.test(
      sha,
    );
  }

  private async recordIgnoredEvent(
    input:
      HandleGithubWebhookInput,
  ): Promise<void> {
    try {
      await this.prisma
        .webhookEvent
        .create({
          data: {
            provider:
              GitProvider.GITHUB,

            eventId:
              input.deliveryId,

            eventType:
              input.eventType,

            payload:
              input.payload as never,

            processingError:
              'IGNORED',
          },
        });
    } catch {
      /*
      * Une collision de delivery id signifie
      * généralement que l'événement a déjà
      * été enregistré.
      */
    }
  }
}
