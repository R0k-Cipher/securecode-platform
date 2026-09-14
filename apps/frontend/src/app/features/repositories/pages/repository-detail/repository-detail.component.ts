import {
  CommonModule,
} from '@angular/common';

import{
  FormsModule,
}from '@angular/forms';

import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  Subject,
  finalize,
  takeUntil,
} from 'rxjs';

import {
  AuthContextService,
} from '../../../../core/auth/auth-context.service';

import {
  PERMISSIONS,
} from '../../../../core/auth/auth-context.models';

import {
  getApiErrorMessage,
} from '../../../../core/utils/api-error.util';

import {
  ReportsService,
  type ReportFormat,
} from '../../../reports/reports.service';

import type {
  ScanListItem,
} from '../../../scans/models/scan.models';

import {
  ScansService,
} from '../../../scans/services/scans.service';

import {
  ScanScheduleService,
  type ScanSchedule,
  type ScanScheduleMode,
} from '../../../scans/services/scan-schedule.service';

import {
  RepositoriesService,
} from '../../services/repositories.service';

@Component({
  selector:
    'app-repository-detail',

  standalone:
    true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl:
    './repository-detail.component.html',

  styleUrl:
    './repository-detail.component.scss',
})
export class RepositoryDetailComponent
  implements OnInit, OnDestroy
{
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly router =
    inject(
      Router,
    );

  private readonly repositories =
    inject(
      RepositoriesService,
    );

  private readonly scans =
    inject(
      ScansService,
    );

  private readonly scanScheduleService =
    inject(
      ScanScheduleService,
    );

  private readonly reportsService =
    inject(
      ReportsService,
    );

  private readonly authContext =
    inject(
      AuthContextService,
    );

  private readonly destroy$ =
    new Subject<void>();

  readonly overview =
    signal<any | null>(
      null,
    );

  readonly scanHistory =
    signal<
      ScanListItem[]
    >(
      [],
    );

  readonly scanSchedule =
  signal<
    ScanSchedule |
    null
  >(
    null,
  );

  readonly loadingSchedule =
    signal(
      false,
    );

  readonly savingSchedule =
    signal(
      false,
    );

  readonly deletingSchedule =
    signal(
      false,
    );

  readonly scheduleMessage =
    signal<
      string |
      null
    >(
      null,
    );

  readonly scheduleError =
    signal<
      string |
      null
    >(
      null,
    );

  scheduleCronExpression =
    '0 2 * * *';

  scheduleTimezone =
    'Africa/Casablanca';

  scheduleMode:
    ScanScheduleMode =
      'FULL';

  scheduleEnabled =
    true;

  readonly loading =
    signal(
      false,
    );

  readonly startingScan =
    signal(
      false,
    );

  readonly error =
    signal<
      string |
      null
    >(
      null,
    );

  organizationId =
    '';

  projectId =
    '';

  repositoryId =
    '';

  readonly canReadRepository =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.REPOSITORY_READ,
            ),
        ),
    );

  readonly canReadScans =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.SCAN_READ,
            ),
        ),
    );

  readonly canCreateScan =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.SCAN_CREATE,
            ),
        ),
    );

  readonly canReadFindings =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.FINDING_READ,
            ),
        ),
    );

  readonly canExportReport =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.REPORT_READ,
            ) &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.REPORT_EXPORT,
            ),
        ),
    );

  readonly totalFindings =
    computed(
      () => {
        const data =
          this.overview();

        if (!data) {
          return 0;
        }

        const severity =
          data.security
            ?.bySeverity ??
          {};

        return (
          Number(
            severity.CRITICAL ??
            0,
          ) +
          Number(
            severity.HIGH ??
            0,
          ) +
          Number(
            severity.MEDIUM ??
            0,
          ) +
          Number(
            severity.LOW ??
            0,
          ) +
          Number(
            severity.INFO ??
            0,
          )
        );
      },
    );

  ngOnInit():
    void {
    this.organizationId =
      this.route.snapshot
        .paramMap
        .get(
          'organizationId',
        ) ??
      '';

    this.projectId =
      this.route.snapshot
        .paramMap
        .get(
          'projectId',
        ) ??
      '';

    this.repositoryId =
      this.route.snapshot
        .paramMap
        .get(
          'repositoryId',
        ) ??
      '';

    this.load();
  }

  ngOnDestroy():
    void {
    this.destroy$
      .next();

    this.destroy$
      .complete();
  }

  load():
    void {
    if (
      !this.organizationId ||
      !this.projectId ||
      !this.repositoryId
    ) {
      return;
    }

    if (
      !this.canReadRepository()
    ) {
      this.error.set(
        "Vous n'avez pas accès à ce repository.",
      );

      return;
    }

    this.loading.set(
      true,
    );

    this.error.set(
      null,
    );

    this.repositories
      .securityOverview(
        this.organizationId,
        this.projectId,
        this.repositoryId,
      )
      .pipe(
        takeUntil(
          this.destroy$,
        ),

        finalize(
          () =>
            this.loading.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          overview => {
            this.overview.set(
              overview,
            );
          },

        error:
          () => {
            this.error.set(
              'Impossible de charger le repository.',
            );
          },
      });

    if (
      this.canReadScans()
    ) {
      this.loadScanSchedule();

      this.scans.listRepositoryScans(
          this.organizationId,
          this.projectId,
          this.repositoryId,
        )
        .pipe(
          takeUntil(
            this.destroy$,
          ),
        )
        .subscribe({
          next:
            result => {
              this.scanHistory.set(
                result.items,
              );
            },

          error:
            () => {
              this.scanHistory.set(
                [],
              );
            },
        });
    }
  }

loadScanSchedule():
  void {
  if (
    !this.canReadScans() ||
    !this.organizationId ||
    !this.projectId ||
    !this.repositoryId
  ) {
    return;
  }

  this.loadingSchedule.set(
    true,
  );

  this.scheduleError.set(
    null,
  );

  this.scanScheduleService
    .get(
      this.organizationId,
      this.projectId,
      this.repositoryId,
    )
    .pipe(
      takeUntil(
        this.destroy$,
      ),

      finalize(
        () =>
          this.loadingSchedule.set(
            false,
          ),
      ),
    )
    .subscribe({
      next:
        schedule => {
          this.scanSchedule.set(
            schedule,
          );

          this.scheduleCronExpression =
            schedule.cronExpression;

          this.scheduleTimezone =
            schedule.timezone;

          this.scheduleMode =
            schedule.mode;

          this.scheduleEnabled =
            schedule.enabled;
        },

      error:
        error => {
          if (
            error?.status ===
            404
          ) {
            this.scanSchedule.set(
              null,
            );

            this.resetScheduleForm();

            return;
          }

          this.scheduleError.set(
            getApiErrorMessage(
              error,
              'Impossible de charger la planification.',
            ),
          );
        },
    });
}

saveScanSchedule():
  void {
  if (
    !this.canCreateScan() ||
    this.savingSchedule()
  ) {
    return;
  }

  const cronExpression =
    this.scheduleCronExpression
      .trim();

  const timezone =
    this.scheduleTimezone
      .trim();

  if (
    !cronExpression
  ) {
    this.scheduleError.set(
      'L’expression cron est obligatoire.',
    );

    return;
  }

  if (
    !timezone
  ) {
    this.scheduleError.set(
      'Le fuseau horaire est obligatoire.',
    );

    return;
  }

  this.savingSchedule.set(
    true,
  );

  this.scheduleError.set(
    null,
  );

  this.scheduleMessage.set(
    null,
  );

  this.scanScheduleService
    .save(
      this.organizationId,
      this.projectId,
      this.repositoryId,
      {
        cronExpression,
        timezone,
        mode:
          this.scheduleMode,

        enabled:
          this.scheduleEnabled,
      },
    )
    .pipe(
      takeUntil(
        this.destroy$,
      ),

      finalize(
        () =>
          this.savingSchedule.set(
            false,
          ),
      ),
    )
    .subscribe({
      next:
        schedule => {
          this.scanSchedule.set(
            schedule,
          );

          this.scheduleCronExpression =
            schedule.cronExpression;

          this.scheduleTimezone =
            schedule.timezone;

          this.scheduleMode =
            schedule.mode;

          this.scheduleEnabled =
            schedule.enabled;

          this.scheduleMessage.set(
            'Planification enregistrée avec succès.',
          );
        },

      error:
        error => {
          this.scheduleError.set(
            getApiErrorMessage(
              error,
              'Impossible d’enregistrer la planification.',
            ),
          );
        },
    });
}

deleteScanSchedule():
  void {
  if (
    !this.canCreateScan() ||
    !this.scanSchedule() ||
    this.deletingSchedule()
  ) {
    return;
  }

  const confirmed =
    window.confirm(
      'Voulez-vous supprimer cette planification ?',
    );

  if (
    !confirmed
  ) {
    return;
  }

  this.deletingSchedule.set(
    true,
  );

  this.scheduleError.set(
    null,
  );

  this.scheduleMessage.set(
    null,
  );

  this.scanScheduleService
    .remove(
      this.organizationId,
      this.projectId,
      this.repositoryId,
    )
    .pipe(
      takeUntil(
        this.destroy$,
      ),

      finalize(
        () =>
          this.deletingSchedule.set(
            false,
          ),
      ),
    )
    .subscribe({
      next:
        () => {
          this.scanSchedule.set(
            null,
          );

          this.resetScheduleForm();

          this.scheduleMessage.set(
            'Planification supprimée avec succès.',
          );
        },

      error:
        error => {
          this.scheduleError.set(
            getApiErrorMessage(
              error,
              'Impossible de supprimer la planification.',
            ),
          );
        },
    });
}

private resetScheduleForm():
  void {
  this.scheduleCronExpression =
    '0 2 * * *';

  this.scheduleTimezone =
    'Africa/Casablanca';

  this.scheduleMode =
    'FULL';

  this.scheduleEnabled =
    true;
}

  startScan():
    void {
    if (
      !this.canCreateScan()
    ) {
      this.error.set(
        "Vous n'avez pas la permission de lancer un scan.",
      );

      return;
    }

    if (
      this.startingScan()
    ) {
      return;
    }

    this.startingScan.set(
      true,
    );

    this.error.set(
      null,
    );

    this.scans
      .createManual(
        this.organizationId,
        this.projectId,
        this.repositoryId,
      )
      .pipe(
        takeUntil(
          this.destroy$,
        ),

        finalize(
          () =>
            this.startingScan.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          result => {
            void this.router.navigate([
              '/organizations',
              this.organizationId,
              'projects',
              this.projectId,
              'scans',
              result.scanId,
            ]);
          },

        error:
          error => {
            this.error.set(
              getApiErrorMessage(
                error,
                'Impossible de lancer le scan.',
              ),
            );
          },
      });
  }

  openScan(
    scanId:
      string,
  ):
    void {
    if (
      !this.canReadScans()
    ) {
      return;
    }

    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'scans',
      scanId,
    ]);
  }

  openFindings():
    void {
    if (
      !this.canReadFindings()
    ) {
      return;
    }

    void this.router.navigate(
      [
        '/organizations',
        this.organizationId,
        'projects',
        this.projectId,
        'findings',
      ],
      {
        queryParams: {
          repositoryId:
            this.repositoryId,
        },
      },
    );
  }

  downloadGeneralReport(
    format:
      ReportFormat =
        'PDF',
  ):
    void {
    if (
      !this.canExportReport()
    ) {
      return;
    }

    this.reportsService
      .createRepository(
        this.organizationId,
        this.projectId,
        this.repositoryId,
        format,
      )
      .subscribe({
        next:
          report => {
            this.reportsService
              .download(
                this.organizationId,
                this.projectId,
                report.id,
              )
              .subscribe({
                next:
                  payload => {
                    this.reportsService
                      .save(
                        payload,
                      );
                  },

                error:
                  () => {
                    this.error.set(
                      'Impossible de télécharger le rapport général.',
                    );
                  },
              });
          },

        error:
          () => {
            this.error.set(
              'Impossible de générer le rapport général.',
            );
          },
      });
  }

  scanStatusLabel(
    status:
      string,
  ):
    string {
    const labels:
      Record<string, string> = {
      QUEUED:
        'En attente',

      PREPARING:
        'Préparation',

      DOWNLOADING:
        'Téléchargement',

      DETECTING:
        'Détection',

      SCANNING:
        'Analyse',

      PROCESSING_RESULTS:
        'Traitement',

      CALCULATING_SCORE:
        'Calcul du score',

      GENERATING_REPORT:
        'Rapport',

      COMPLETED:
        'Terminé',

      FAILED:
        'Échec',

      CANCELLED:
        'Annulé',
    };

    return (
      labels[
        status
      ] ??
      status
    );
  }
}
