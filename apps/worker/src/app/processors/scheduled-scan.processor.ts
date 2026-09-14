import {
  Logger,
} from '@nestjs/common';

import {
  InjectQueue,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';

import {
  Job,
  Queue,
} from 'bullmq';

import {
  AuditAction,
  ConnectionStatus,
  GitProvider,
  ProjectStatus,
  ScanScheduleMode,
  ScanStatus,
  ScanTrigger,
  ScanType,
} from '@prisma/client';

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
  ScheduledScanJobData,
  SecurityScanJobData,
} from '@securecode-platform/queue-contracts';

import {
  GithubWorkerClientService,
} from '../services/github-worker-client.service';

@Processor(
  QUEUE_NAMES.SCAN_SCHEDULER,
)
export class ScheduledScanProcessor
  extends WorkerHost
{
  private readonly logger =
    new Logger(
      ScheduledScanProcessor.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly githubClient:
      GithubWorkerClientService,

    @InjectQueue(
      QUEUE_NAMES.SECURITY_SCAN,
    )
    private readonly securityScanQueue:
      Queue<SecurityScanJobData>,
  ) {
    super();
  }

  async process(
    job:
      Job<ScheduledScanJobData>,
  ) {
    if (
      job.name !==
      JOB_NAMES.SCHEDULED_SCAN_TICK
    ) {
      throw new Error(
        `Job scan scheduler inconnu : ${job.name}`,
      );
    }

    const data =
      job.data;

    /*
     * ------------------------------------------------
     * 1. Schedule + isolation tenant
     * ------------------------------------------------
     */

    const schedule =
      await this.prisma.scanSchedule
        .findUnique({
          where: {
            id:
              data.scheduleId,
          },

          select: {
            id:
              true,

            organizationId:
              true,

            projectId:
              true,

            repositoryId:
              true,

            enabled:
              true,

            mode:
              true,

            repository: {
              select: {
                id:
                  true,

                organizationId:
                  true,

                projectId:
                  true,

                gitConnectionId:
                  true,

                provider:
                  true,

                externalId:
                  true,

                owner:
                  true,

                name:
                  true,

                fullName:
                  true,

                defaultBranch:
                  true,

                isArchived:
                  true,

                project: {
                  select: {
                    status:
                      true,
                  },
                },

                gitConnection: {
                  select: {
                    id:
                      true,

                    status:
                      true,

                    installationId:
                      true,
                  },
                },
              },
            },
          },
        });

    /*
     * Schedule supprimé :
     * ancien job Redis éventuel = NO-OP.
     */
    if (!schedule) {
      this.logger.warn(
        `Schedule ${data.scheduleId} supprimé : job ignoré.`,
      );

      return {
        skipped:
          true,

        reason:
          'SCHEDULE_NOT_FOUND',
      };
    }

    /*
     * Schedule désactivé :
     * aucun scan.
     */
    if (!schedule.enabled) {
      return {
        skipped:
          true,

        reason:
          'SCHEDULE_DISABLED',
      };
    }

    if (
      schedule.organizationId !==
        data.organizationId ||
      schedule.projectId !==
        data.projectId ||
      schedule.repositoryId !==
        data.repositoryId
    ) {
      throw new Error(
        'Contexte multi-tenant du schedule incohérent.',
      );
    }

    const repository =
      schedule.repository;

    if (
      repository.organizationId !==
        schedule.organizationId ||
      repository.projectId !==
        schedule.projectId
    ) {
      throw new Error(
        'Le repository du schedule appartient à un autre tenant/projet.',
      );
    }

    if (
      repository.isArchived ||
      repository.project.status !==
        ProjectStatus.ACTIVE
    ) {
      return {
        skipped:
          true,

        reason:
          'REPOSITORY_OR_PROJECT_INACTIVE',
      };
    }

    if (
      repository.gitConnection
        .status !==
      ConnectionStatus.ACTIVE
    ) {
      throw new Error(
        'Connexion Git inactive.',
      );
    }

    if (
      repository.provider !==
      GitProvider.GITHUB
    ) {
      throw new Error(
        'Scheduled Scan GitLab non encore supporté par ce worker.',
      );
    }

    const installationId =
      repository.gitConnection
        .installationId;

    if (!installationId) {
      throw new Error(
        'Installation GitHub absente.',
      );
    }

    const branch =
      repository.defaultBranch;

    if (!branch) {
      throw new Error(
        'Branche par défaut absente.',
      );
    }

    /*
     * ------------------------------------------------
     * 2. Résoudre le SHA GitHub exact
     * ------------------------------------------------
     */

    const latestCommit =
      await this.githubClient
        .getLatestCommit(
          installationId,
          repository.owner,
          repository.name,
          branch,
        );

    const targetSha =
      latestCommit.sha;

    /*
     * ------------------------------------------------
     * 3. Empêcher seulement les scans ACTIFS identiques
     * ------------------------------------------------
     *
     * On ne bloque PAS un ancien COMPLETED sur le même SHA.
     *
     * Pourquoi ?
     * Une nouvelle CVE peut apparaître aujourd'hui alors que
     * le code n'a pas changé depuis hier.
     */

    const activeScan =
      await this.prisma.scan
        .findFirst({
          where: {
            projectId:
              schedule.projectId,

            repositoryId:
              schedule.repositoryId,

            commitSha:
              targetSha,

            status: {
              in: [
                ScanStatus.QUEUED,
                ScanStatus.PREPARING,
                ScanStatus.DOWNLOADING,
                ScanStatus.DETECTING,
                ScanStatus.SCANNING,
                ScanStatus.PROCESSING_RESULTS,
                ScanStatus.CALCULATING_SCORE,
                ScanStatus.GENERATING_REPORT,
              ],
            },
          },

          select: {
            id:
              true,

            status:
              true,
          },
        });

    if (activeScan) {
      await this.prisma.scanSchedule
        .update({
          where: {
            id:
              schedule.id,
          },

          data: {
            lastTriggeredAt:
              new Date(),
          },
        });

      return {
        skipped:
          true,

        reason:
          'SCAN_ALREADY_RUNNING',

        scanId:
          activeScan.id,
      };
    }

    /*
     * ------------------------------------------------
     * 4. Dernier scan terminé
     * ------------------------------------------------
     */

    const previousScan =
      await this.prisma.scan
        .findFirst({
          where: {
            projectId:
              schedule.projectId,

            repositoryId:
              schedule.repositoryId,

            status:
              ScanStatus.COMPLETED,
          },

          orderBy: {
            completedAt:
              'desc',
          },

          select: {
            commitSha:
              true,
          },
        });

    const previousSha =
      previousScan
        ?.commitSha ??
      null;

    /*
     * Scheduled AUTO + même commit :
     *
     * on force FULL pour rechecker :
     * - nouvelles CVE ;
     * - dépendances ;
     * - secrets/règles mises à jour.
     *
     * Sinon AUTO peut faire un incremental normal.
     */
    const requestedMode:
      SecurityScanJobData['requestedMode'] =
      schedule.mode ===
        ScanScheduleMode.FULL
        ? 'FULL'
        : previousSha ===
            targetSha
          ? 'FULL'
          : 'AUTO';

    /*
     * Pour un FULL on met fromSha=null.
     *
     * Le planner comprend immédiatement
     * qu'un contexte complet est requis.
     */
    const fromSha =
      requestedMode ===
      'FULL'
        ? null
        : previousSha;

    const correlationId =
      randomUUID();

    /*
     * ------------------------------------------------
     * 5. Créer le Scan
     * ------------------------------------------------
     *
     * FULL_SCAN est une valeur initiale.
     *
     * SecurityScanProcessor remplacera le type
     * par FULL_SCAN/INCREMENTAL_SCAN pour SCHEDULED
     * après calcul réel du planner.
     */

    const scan =
      await this.prisma.scan
        .create({
          data: {
            projectId:
              schedule.projectId,

            repositoryId:
              schedule.repositoryId,

            requestedById:
              null,

            type:
              ScanType.FULL_SCAN,

            trigger:
              ScanTrigger.SCHEDULED,

            status:
              ScanStatus.QUEUED,

            branch,

            commitSha:
              targetSha,

            progress:
              0,

            configuration: {
              scheduled:
                true,

              scheduleId:
                schedule.id,

              configuredMode:
                schedule.mode,

              requestedMode,

              fromSha,

              toSha:
                targetSha,

              correlationId,
            },
          },
        });

    /*
     * ------------------------------------------------
     * 6. SECURITY_SCAN
     * ------------------------------------------------
     */

    const securityJob:
      SecurityScanJobData = {
      organizationId:
        schedule.organizationId,

      projectId:
        schedule.projectId,

      repositoryId:
        schedule.repositoryId,

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

      fromSha,

      toSha:
        targetSha,

      pullRequestId:
        null,

      requestedMode,

      trigger:
        'SCHEDULED',

      triggeredById:
        null,

      eventId:
        null,

      requestedAt:
        new Date()
          .toISOString(),

      correlationId,
    };

    try {
      const securityJobResult =
        await this.securityScanQueue
          .add(
            JOB_NAMES.SECURITY_SCAN,
            securityJob,
            {
              jobId:
                `security-scan-${scan.id}`,

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

      const now =
        new Date();

      await this.prisma.$transaction([
        this.prisma.scan.update({
          where: {
            id:
              scan.id,
          },

          data: {
            queueJobId:
              securityJobResult.id
                ? String(
                    securityJobResult.id,
                  )
                : null,
          },
        }),

        this.prisma.scanSchedule.update({
          where: {
            id:
              schedule.id,
          },

          data: {
            lastTriggeredAt:
              now,
          },
        }),

        this.prisma.auditLog.create({
          data: {
            organizationId:
              schedule.organizationId,

            projectId:
              schedule.projectId,

            actorId:
              null,

            action:
              AuditAction.SCAN,

            resourceType:
              'Scan',

            resourceId:
              scan.id,

            description:
              'Scan programmé déclenché automatiquement.',

            metadata: {
              repositoryId:
                schedule.repositoryId,

              scheduleId:
                schedule.id,

              branch,

              commitSha:
                targetSha,

              requestedMode,

              correlationId,
            },
          },
        }),
      ]);

      this.logger.log(
        `Scheduled scan ${scan.id} planifié pour ${repository.fullName}@${targetSha}.`,
      );

      return {
        scanId:
          scan.id,

        repositoryId:
          schedule.repositoryId,

        commitSha:
          targetSha,

        requestedMode,

        correlationId,
      };
    } catch (error) {
      await this.prisma.scan
        .update({
          where: {
            id:
              scan.id,
          },

          data: {
            status:
              ScanStatus.FAILED,

            failedAt:
              new Date(),

            errorMessage:
              'Impossible de planifier le Scheduled Scan.',
          },
        });

      throw error;
    }
  }
}
