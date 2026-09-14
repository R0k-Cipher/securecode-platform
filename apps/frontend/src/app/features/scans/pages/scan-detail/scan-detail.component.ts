import {
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  CommonModule,
} from '@angular/common';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  Subject,
  takeUntil,
} from 'rxjs';

import {
  ScanProgressService,
} from '../../services/scan-progress.service';

import {
  ScansService,
} from '../../services/scans.service';

import type {
  ScanDetail,
  ScanProgress,
} from '../../models/scan.models';

import {
  ReportsService,
  type ReportFormat,
} from '../../../reports/reports.service';

import {
  AuthContextService,
} from '../../../../core/auth/auth-context.service';

import {
  PERMISSIONS,
} from '../../../../core/auth/auth-context.models';

@Component({
  selector:
    'app-scan-detail',

  standalone:
    true,

  imports: [
    CommonModule,
  ],

  templateUrl:
    './scan-detail.component.html',

  styleUrl:
    './scan-detail.component.scss',
})
export class ScanDetailComponent
  implements
    OnInit,
    OnDestroy
{
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly router =
    inject(
      Router,
    );

  private readonly scans =
    inject(
      ScansService,
    );

  private readonly progressService =
    inject(
      ScanProgressService,
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

  private terminalReloaded =
    false;

  organizationId =
    '';

  projectId =
    '';

  scanId =
    '';

  readonly progress =
    signal<
      ScanProgress |
      null
    >(
      null,
    );

  readonly detail =
    signal<
      ScanDetail |
      null
    >(
      null,
    );

  readonly cancelling =
    signal(
      false,
    );

  readonly generatingReport =
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

  /*
  |--------------------------------------------------------------------------
  | Permissions
  |--------------------------------------------------------------------------
  */

  readonly canReadScan =
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

  readonly canCancelScan =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.SCAN_CANCEL,
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
              PERMISSIONS.REPORT_EXPORT,
            ),
        ),
    );

  /*
  |--------------------------------------------------------------------------
  | Presentation helpers
  |--------------------------------------------------------------------------
  */

  readonly securityScore =
    computed(
      () =>
        this.progress()
          ?.score ??
        this.detail()
          ?.score ??
        null,
    );

  readonly scanStatus =
    computed(
      () =>
        this.progress()
          ?.status ??
        this.detail()
          ?.status ??
        'UNKNOWN',
    );

  readonly progressValue =
    computed(
      () =>
        this.progress()
          ?.progress ??
        this.detail()
          ?.progress ??
        0,
    );

  readonly severityTotal =
    computed(
      () => {
        const statistics =
          this.detail()
            ?.statistics;

        if (!statistics) {
          return 0;
        }

        return (
          Number(
            statistics[
              'activeCritical'
            ] ??
            0,
          ) +
          Number(
            statistics[
              'activeHigh'
            ] ??
            0,
          ) +
          Number(
            statistics[
              'activeMedium'
            ] ??
            0,
          ) +
          Number(
            statistics[
              'activeLow'
            ] ??
            0,
          ) +
          Number(
            statistics[
              'activeInfo'
            ] ??
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

    this.scanId =
      this.route.snapshot
        .paramMap
        .get(
          'scanId',
        ) ??
      '';

    if (
      !this.canReadScan()
    ) {
      this.error.set(
        "Vous n'avez pas la permission de consulter ce scan.",
      );

      return;
    }

    this.loadDetail();

    this.progressService
      .watch(
        this.organizationId,
        this.projectId,
        this.scanId,
      )
      .pipe(
        takeUntil(
          this.destroy$,
        ),
      )
      .subscribe({
        next:
          progress => {
            this.progress.set(
              progress,
            );

            if (
              this.isTerminal(
                progress.status,
              ) &&
              !this.terminalReloaded
            ) {
              this.terminalReloaded =
                true;

              this.loadDetail();
            }
          },

        error:
          () => {
            this.error.set(
              'Impossible de suivre la progression du scan.',
            );
          },
      });
  }

  ngOnDestroy():
    void {
    this.destroy$
      .next();

    this.destroy$
      .complete();
  }

  loadDetail():
    void {
    if (
      !this.canReadScan()
    ) {
      return;
    }

    this.scans
      .getScan(
        this.organizationId,
        this.projectId,
        this.scanId,
      )
      .subscribe({
        next:
          detail => {
            this.detail.set(
              detail,
            );
          },

        error:
          error => {
            this.error.set(
              error?.error?.message ??
              'Impossible de charger les détails du scan.',
            );
          },
      });
  }

  cancel():
    void {
    if (
      !this.canCancelScan()
    ) {
      this.error.set(
        "Vous n'avez pas la permission d'annuler ce scan.",
      );

      return;
    }

    if (
      this.cancelling()
    ) {
      return;
    }

    this.cancelling.set(
      true,
    );

    this.error.set(
      null,
    );

    this.scans
      .cancel(
        this.organizationId,
        this.projectId,
        this.scanId,
      )
      .subscribe({
        next:
          () => {
            this.cancelling.set(
              false,
            );

            this.loadDetail();
          },

        error:
          error => {
            this.cancelling.set(
              false,
            );

            this.error.set(
              error?.error?.message ??
              'Impossible d’annuler le scan.',
            );
          },
      });
  }

  viewFindings():
    void {
    if (
      !this.canReadFindings()
    ) {
      this.error.set(
        "Vous n'avez pas la permission de consulter les findings.",
      );

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
          scanId:
            this.scanId,
        },
      },
    );
  }

  isTerminal(
    status:
      string,
  ):
    boolean {
    return [
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ].includes(
      status,
    );
  }

  canCancel():
    boolean {
    if (
      !this.canCancelScan()
    ) {
      return false;
    }

    const status =
      this.progress()
        ?.status ??
      this.detail()
        ?.status;

    if (!status) {
      return false;
    }

    return !this.isTerminal(
      status,
    );
  }

  downloadReport(
    format:
      ReportFormat =
      'PDF',
  ):
    void {
    if (
      !this.canExportReport()
    ) {
      this.error.set(
        "Vous n'avez pas la permission de générer ce rapport.",
      );

      return;
    }

    if (
      this.generatingReport() ||
      this.detail()
        ?.status !==
        'COMPLETED'
    ) {
      return;
    }

    this.generatingReport.set(
      true,
    );

    this.error.set(
      null,
    );

    this.reportsService
      .createScan(
        this.organizationId,
        this.projectId,
        this.scanId,
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

                    this.generatingReport.set(
                      false,
                    );
                  },

                error:
                  () => {
                    this.generatingReport.set(
                      false,
                    );

                    this.error.set(
                      'Le rapport a été généré mais son téléchargement a échoué.',
                    );
                  },
              });
          },

        error:
          error => {
            this.generatingReport.set(
              false,
            );

            this.error.set(
              error?.error?.message ??
              'Impossible de générer le rapport du scan.',
            );
          },
      });
  }

  statusLabel(
    status:
      string,
  ):
    string {
    const labels:
      Record<
        string,
        string
      > = {
      QUEUED:
        'En attente',

      PREPARING:
        'Préparation',

      DOWNLOADING:
        'Téléchargement',

      DETECTING:
        'Détection',

      SCANNING:
        'Analyse en cours',

      PROCESSING_RESULTS:
        'Traitement des résultats',

      CALCULATING_SCORE:
        'Calcul du score',

      GENERATING_REPORT:
        'Génération du rapport',

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

  triggerLabel(
    trigger:
      string,
  ):
    string {
    const labels:
      Record<
        string,
        string
      > = {
      MANUAL:
        'Manuel',

      PUSH:
        'Push',

      PULL_REQUEST:
        'Pull Request',

      RELEASE:
        'Release',

      SCHEDULED:
        'Planifié',

      API:
        'API',
    };

    return (
      labels[
        trigger
      ] ??
      trigger
    );
  }

  typeLabel(
    type:
      string,
  ):
    string {
    const labels:
      Record<
        string,
        string
      > = {
      MANUAL_SCAN:
        'Scan manuel',

      FULL_SCAN:
        'Scan complet',

      INCREMENTAL_SCAN:
        'Scan incrémental',

      PULL_REQUEST_SCAN:
        'Pull Request',

      RELEASE_SCAN:
        'Release',
    };

    return (
      labels[
        type
      ] ??
      type
    );
  }
}
