import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';

import {
  InjectQueue,
} from '@nestjs/bullmq';

import type {
  Queue,
} from 'bullmq';

import {
  AuditAction,
  ConnectionStatus,
  GitProvider,
  ProjectStatus,
  ScanScheduleMode,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import {
  JOB_NAMES,
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';

import type {
  ScheduledScanJobData,
} from '@securecode-platform/queue-contracts';

import {
  UpsertScanScheduleDto,
} from './dto/upsert-scan-schedule.dto';

@Injectable()
export class ScanSchedulesService
  implements OnModuleInit
{
  private readonly logger =
    new Logger(
      ScanSchedulesService.name,
    );

  constructor(
    private readonly prisma:
      PrismaService,

    @InjectQueue(
      QUEUE_NAMES.SCAN_SCHEDULER,
    )
    private readonly schedulerQueue:
      Queue<ScheduledScanJobData>,
  ) {}

  /*
   * Au démarrage API, on resynchronise
   * PostgreSQL -> BullMQ.
   *
   * Ça protège contre :
   * - redémarrage Redis ;
   * - scheduler Redis supprimé ;
   * - déploiement ;
   * - configuration partiellement enregistrée.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.reconcileEnabledSchedules();
    } catch (error) {
      this.logger.error(
        'Impossible de réconcilier les scans programmés au démarrage.',
        error instanceof Error
          ? error.stack
          : String(error),
      );
    }
  }

  async get(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    await this.ensureRepository(
      organizationId,
      projectId,
      repositoryId,
    );

    const schedule =
      await this.prisma.scanSchedule
        .findUnique({
          where: {
            repositoryId,
          },
        });

    if (!schedule) {
      throw new NotFoundException(
        'Aucune planification de scan pour ce repository.',
      );
    }

    return schedule;
  }

  async upsert(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    currentUserId: string,
    dto: UpsertScanScheduleDto,
  ) {
    await this.ensureRepository(
      organizationId,
      projectId,
      repositoryId,
    );

    const cronExpression =
      dto.cronExpression.trim();

    this.validateCronExpression(
      cronExpression,
    );

    const timezone =
      this.normalizeTimezone(
        dto.timezone,
      );

    const mode =
      dto.mode ??
      ScanScheduleMode.AUTO;

    const enabled =
      dto.enabled ??
      true;

    const existing =
      await this.prisma.scanSchedule
        .findUnique({
          where: {
            repositoryId,
          },

          select: {
            id:
              true,
          },
        });

    const schedule =
      await this.prisma.scanSchedule
        .upsert({
          where: {
            repositoryId,
          },

          create: {
            organizationId,
            projectId,
            repositoryId,
            createdById:
              currentUserId,

            cronExpression,
            timezone,
            mode,
            enabled,
          },

          update: {
            /*
             * organizationId/projectId ne sont
             * volontairement pas modifiés.
             *
             * repositoryId est unique et sa relation
             * tenant est vérifiée avant cet upsert.
             */
            cronExpression,
            timezone,
            mode,
            enabled,
          },
        });

    try {
      if (schedule.enabled) {
        await this.installScheduler(
          schedule,
        );
      } else {
        await this.removeScheduler(
          schedule.id,
        );
      }
    } catch (error) {
      /*
       * Sécurité :
       *
       * Ne jamais conserver "enabled=true"
       * en PostgreSQL si BullMQ n'a pas accepté
       * la planification.
       */
      await this.prisma.scanSchedule
        .update({
          where: {
            id:
              schedule.id,
          },

          data: {
            enabled:
              false,
          },
        });

      this.logger.error(
        `Impossible d'installer le scheduler ${schedule.id}.`,
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw new BadRequestException(
        error instanceof Error
          ? `Planification invalide ou indisponible : ${error.message}`
          : 'Impossible de créer la planification.',
      );
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        projectId,

        actorId:
          currentUserId,

        action:
          existing
            ? AuditAction.UPDATE
            : AuditAction.CREATE,

        resourceType:
          'ScanSchedule',

        resourceId:
          schedule.id,

        description:
          existing
            ? 'Planification de scan mise à jour.'
            : 'Planification de scan créée.',

        metadata: {
          repositoryId,
          cronExpression,
          timezone,
          mode,
          enabled,
        },
      },
    });

    return this.prisma.scanSchedule
      .findUniqueOrThrow({
        where: {
          id:
            schedule.id,
        },
      });
  }

  async remove(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    currentUserId: string,
  ) {
    await this.ensureRepository(
      organizationId,
      projectId,
      repositoryId,
    );

    const schedule =
      await this.prisma.scanSchedule
        .findUnique({
          where: {
            repositoryId,
          },
        });

    if (!schedule) {
      throw new NotFoundException(
        'Aucune planification de scan pour ce repository.',
      );
    }

    /*
     * PostgreSQL est supprimé en premier.
     *
     * Même si Redis est momentanément indisponible,
     * un ancien tick BullMQ ne pourra plus lancer
     * de scan : le worker vérifiera que le schedule
     * existe encore en DB.
     */
    await this.prisma.scanSchedule.delete({
      where: {
        id:
          schedule.id,
      },
    });

    try {
      await this.removeScheduler(
        schedule.id,
      );
    } catch (error) {
      this.logger.warn(
        `Le scheduler BullMQ ${schedule.id} n'a pas pu être supprimé immédiatement. ` +
          `Il sera néanmoins ignoré par le worker.`,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        projectId,

        actorId:
          currentUserId,

        action:
          AuditAction.DELETE,

        resourceType:
          'ScanSchedule',

        resourceId:
          schedule.id,

        description:
          'Planification de scan supprimée.',

        metadata: {
          repositoryId,
          cronExpression:
            schedule.cronExpression,

          timezone:
            schedule.timezone,

          mode:
            schedule.mode,
        },
      },
    });

    return {
      message:
        'Planification supprimée avec succès.',
    };
  }

  /*
   * ============================================================
   * BullMQ
   * ============================================================
   */

  private async installScheduler(
    schedule: {
      id: string;
      organizationId: string;
      projectId: string;
      repositoryId: string;
      cronExpression: string;
      timezone: string;
      enabled: boolean;
    },
  ): Promise<void> {
    if (!schedule.enabled) {
      return;
    }

    const data:
      ScheduledScanJobData = {
        scheduleId:
          schedule.id,

        organizationId:
          schedule.organizationId,

        projectId:
          schedule.projectId,

        repositoryId:
          schedule.repositoryId,
      };

    await this.schedulerQueue
      .upsertJobScheduler(
        this.getSchedulerId(
          schedule.id,
        ),

        {
          pattern:
            schedule.cronExpression,

          tz:
            schedule.timezone,
        },

        {
          name:
            JOB_NAMES.SCHEDULED_SCAN_TICK,

          data,

          opts: {
            removeOnComplete:
              100,

            removeOnFail:
              500,
          },
        },
      );
  }

  private async removeScheduler(
    scheduleId: string,
  ): Promise<void> {
    await this.schedulerQueue
      .removeJobScheduler(
        this.getSchedulerId(
          scheduleId,
        ),
      );
  }

  private getSchedulerId(
    scheduleId: string,
  ): string {
    return `scan-schedule:${scheduleId}`;
  }

  /*
   * ============================================================
   * Reconciliation
   * ============================================================
   */

  private async reconcileEnabledSchedules():
    Promise<void> {
    const schedules =
      await this.prisma.scanSchedule
        .findMany({
          where: {
            enabled:
              true,
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

            cronExpression:
              true,

            timezone:
              true,

            enabled:
              true,
          },
        });

    for (
      const schedule
      of schedules
    ) {
      try {
        await this.installScheduler(
          schedule,
        );
      } catch (error) {
        this.logger.error(
          `Réconciliation du schedule ${schedule.id} échouée.`,
          error instanceof Error
            ? error.stack
            : String(error),
        );
      }
    }
  }

  /*
   * ============================================================
   * Validation
   * ============================================================
   */

  private async ensureRepository(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    const repository =
      await this.prisma.repository
        .findFirst({
          where: {
            id:
              repositoryId,

            organizationId,

            projectId,

            isArchived:
              false,

            project: {
              status:
                ProjectStatus.ACTIVE,
            },
          },

          select: {
            id:
              true,

            provider:
              true,

            gitConnection: {
              select: {
                status:
                  true,

                installationId:
                  true,
              },
            },
          },
        });

    if (!repository) {
      throw new NotFoundException(
        'Repository introuvable ou projet inactif.',
      );
    }

    if (
      repository.gitConnection
        .status !==
      ConnectionStatus.ACTIVE
    ) {
      throw new ConflictException(
        'La connexion Git du repository n’est pas active.',
      );
    }

    if (
      repository.provider !==
      GitProvider.GITHUB
    ) {
      throw new ConflictException(
        'Les scans programmés sont actuellement disponibles pour GitHub.',
      );
    }

    if (
      !repository.gitConnection
        .installationId
    ) {
      throw new ConflictException(
        'Installation GitHub absente.',
      );
    }

    return repository;
  }

  private normalizeTimezone(
    timezone?: string,
  ): string {
    const value =
      timezone?.trim() ||
      'UTC';

    try {
      /*
       * Intl déclenche RangeError
       * lorsqu'un timezone IANA est invalide.
       */
      new Intl.DateTimeFormat(
        'en-US',
        {
          timeZone:
            value,
        },
      ).format(
        new Date(),
      );
    } catch {
      throw new BadRequestException(
        `Timezone invalide : "${value}".`,
      );
    }

    return value;
  }

  private validateCronExpression(
    cronExpression: string,
  ): void {
    const parts =
      cronExpression
        .trim()
        .split(/\s+/);

    /*
     * BullMQ accepte cron-parser :
     * 5 ou 6 champs.
     *
     * La validation exacte sera ensuite
     * réalisée par BullMQ lors du
     * upsertJobScheduler.
     */
    if (
      parts.length !== 5 &&
      parts.length !== 6
    ) {
      throw new BadRequestException(
        'Expression cron invalide. Elle doit contenir 5 ou 6 champs.',
      );
    }
  }
}
