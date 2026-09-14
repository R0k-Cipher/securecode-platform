import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  ActivatedRoute,
} from '@angular/router';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
  EMPTY,
  finalize,
  interval,
  switchMap,
  timeout,
} from 'rxjs';

import {
  AuthContextService,
} from '../../../../core/auth/auth-context.service';

import {
  PERMISSIONS,
} from '../../../../core/auth/auth-context.models';

import {
  ReportsService,
  type ProjectReport,
  type ReportFormat,
  type ReportScope,
} from '../../reports.service';

@Component({
  selector:
    'app-reports-page',

  standalone:
    true,

  imports: [
    CommonModule,
  ],

  templateUrl:
    './reports-page.component.html',

  styleUrl:
    './reports-page.component.scss',
})
export class ReportsPageComponent {
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly service =
    inject(
      ReportsService,
    );

  private readonly authContext =
    inject(
      AuthContextService,
    );

  private readonly destroyRef =
    inject(
      DestroyRef,
    );

  private pollingStarted =
    false;

  readonly organizationId =
    this.route.snapshot
      .paramMap
      .get(
        'organizationId',
      )!;

  readonly projectId =
    this.route.snapshot
      .paramMap
      .get(
        'projectId',
      )!;

  /*
  |--------------------------------------------------------------------------
  | Permissions
  |--------------------------------------------------------------------------
  */

  readonly canReadReports =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.REPORT_READ,
            ),
        ),
    );

  readonly canExportReports =
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
  | State
  |--------------------------------------------------------------------------
  */

  readonly loading =
    signal(
      false,
    );

  readonly refreshing =
    signal(
      false,
    );

  readonly loadError =
    signal<
      string |
      null
    >(
      null,
    );

  readonly downloadingId =
    signal<
      string |
      null
    >(
      null,
    );

  readonly reports =
    signal<
      ProjectReport[]
    >(
      [],
    );

  /*
  |--------------------------------------------------------------------------
  | Create project report
  |--------------------------------------------------------------------------
  */

  readonly customReportOpen =
    signal(
      false,
    );

  readonly generatingCustomReport =
    signal(
      false,
    );

  readonly customFromDate =
    signal(
      '',
    );

  readonly customToDate =
    signal(
      '',
    );

  readonly customFormat =
    signal<ReportFormat>(
      'PDF',
    );

  readonly customReportError =
    signal<
      string |
      null
    >(
      null,
    );

  readonly customReportMessage =
    signal<
      string |
      null
    >(
      null,
    );

  /*
  |--------------------------------------------------------------------------
  | Statistics
  |--------------------------------------------------------------------------
  */

  readonly totalReports =
    computed(
      () =>
        this.reports()
          .length,
    );

  readonly readyReports =
    computed(
      () =>
        this.reports()
          .filter(
            report =>
              report.status ===
              'READY',
          )
          .length,
    );

  readonly processingReports =
    computed(
      () =>
        this.reports()
          .filter(
            report =>
              this.isProcessing(
                report,
              ),
          )
          .length,
    );

  readonly scanReports =
    computed(
      () =>
        this.reports()
          .filter(
            report =>
              this.scope(
                report,
              ) ===
              'SCAN',
          )
          .length,
    );

  readonly repositoryReports =
    computed(
      () =>
        this.reports()
          .filter(
            report =>
              this.scope(
                report,
              ) ===
              'REPOSITORY',
          )
          .length,
    );

  readonly projectReports =
    computed(
      () =>
        this.reports()
          .filter(
            report =>
              this.scope(
                report,
              ) ===
              'PROJECT',
          )
          .length,
    );

  readonly latestReport =
    computed(
      () =>
        this.reports()[
          0
        ] ??
        null,
    );

  constructor() {
    this.load();

    this.startPolling();
  }

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  load(
    silent =
      false,
  ):
    void {
    if (
      !this.canReadReports()
    ) {
      this.reports.set(
        [],
      );

      this.loading.set(
        false,
      );

      this.refreshing.set(
        false,
      );

      this.loadError.set(
        "Vous n'avez pas la permission de consulter les rapports de ce projet.",
      );

      return;
    }

    if (silent) {
      this.refreshing.set(
        true,
      );
    } else {
      this.loading.set(
        true,
      );
    }

    this.loadError.set(
      null,
    );

    this.service
      .list(
        this.organizationId,
        this.projectId,
      )
      .pipe(
        timeout(
          15_000,
        ),

        finalize(
          () => {
            this.loading.set(
              false,
            );

            this.refreshing.set(
              false,
            );
          },
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe({
        next:
          response => {
            const reports =
              [
                ...response.data,
              ]
                .sort(
                  (
                    left,
                    right,
                  ) =>
                    new Date(
                      right.createdAt,
                    ).getTime() -
                    new Date(
                      left.createdAt,
                    ).getTime(),
                );

            this.reports.set(
              reports,
            );
          },

        error:
          error => {
            this.loadError.set(
              error?.error?.message ??
                error?.message ??
                'Impossible de charger les rapports de ce projet.',
            );
          },
      });
  }

  private startPolling():
    void {
    if (
      this.pollingStarted
    ) {
      return;
    }

    this.pollingStarted =
      true;

    interval(
      5_000,
    )
      .pipe(
        switchMap(
          () => {
            const hasPending =
              this.reports()
                .some(
                  report =>
                    this.isProcessing(
                      report,
                    ),
                );

            if (
              !hasPending
            ) {
              return EMPTY;
            }

            return this.service
              .list(
                this.organizationId,
                this.projectId,
              )
              .pipe(
                timeout(
                  10_000,
                ),
              );
          },
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe({
        next:
          response => {
            const reports =
              [
                ...response.data,
              ]
                .sort(
                  (
                    left,
                    right,
                  ) =>
                    new Date(
                      right.createdAt,
                    ).getTime() -
                    new Date(
                      left.createdAt,
                    ).getTime(),
                );

            this.reports.set(
              reports,
            );
          },

        error:
          () => {
            /*
             * Le polling ne doit jamais casser
             * la page principale.
             */
          },
      });
  }

  /*
  |--------------------------------------------------------------------------
  | Scope
  |--------------------------------------------------------------------------
  */

  scope(
    report:
      ProjectReport,
  ):
    Exclude<
      ReportScope,
      'ORGANIZATION'
    > {
    if (
      report.scope ===
      'PROJECT' ||
      report.filters
        ?.['scope'] ===
        'PROJECT'
    ) {
      return 'PROJECT';
    }

    if (
      report.scope ===
      'SCAN' ||
      report.scanId
    ) {
      return 'SCAN';
    }

    return 'REPOSITORY';
  }

  scopeLabel(
    report:
      ProjectReport,
  ):
    string {
    switch (
      this.scope(
        report,
      )
    ) {
      case 'SCAN':
        return 'Scan';

      case 'PROJECT':
        return 'Projet';

      case 'REPOSITORY':
        return 'Repository';
    }
  }

  scopeDescription(
    report:
      ProjectReport,
  ):
    string {
    switch (
      this.scope(
        report,
      )
    ) {
      case 'SCAN':
        return 'Analyse liée à un scan précis';

      case 'REPOSITORY':
        return 'Synthèse d’un repository';

      case 'PROJECT':
        return 'Vue consolidée du projet';
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Create
  |--------------------------------------------------------------------------
  */

  openCustomReport():
    void {
    if (
      !this.canExportReports()
    ) {
      return;
    }

    this.customReportError.set(
      null,
    );

    this.customReportMessage.set(
      null,
    );

    if (
      !this.customFromDate()
    ) {
      this.customFromDate.set(
        this.defaultFromDate(),
      );
    }

    if (
      !this.customToDate()
    ) {
      this.customToDate.set(
        this.defaultToDate(),
      );
    }

    this.customReportOpen.set(
      true,
    );
  }

  closeCustomReport():
    void {
    if (
      this.generatingCustomReport()
    ) {
      return;
    }

    this.customReportOpen.set(
      false,
    );
  }

  generateCustomReport():
    void {
    if (
      !this.canExportReports()
    ) {
      return;
    }

    const fromDate =
      this.customFromDate();

    const toDate =
      this.customToDate();

    if (
      !fromDate ||
      !toDate
    ) {
      this.customReportError.set(
        'Veuillez sélectionner les deux dates.',
      );

      return;
    }

    if (
      fromDate >
      toDate
    ) {
      this.customReportError.set(
        'La date de début doit être antérieure ou égale à la date de fin.',
      );

      return;
    }

    this.generatingCustomReport.set(
      true,
    );

    this.customReportError.set(
      null,
    );

    this.customReportMessage.set(
      null,
    );

    this.service
      .createProject(
        this.organizationId,
        this.projectId,
        fromDate,
        toDate,
        this.customFormat(),
      )
      .pipe(
        finalize(
          () =>
            this.generatingCustomReport
              .set(
                false,
              ),
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe({
        next:
          report => {
            this.customReportMessage.set(
              'Rapport ajouté à la file de génération.',
            );

            this.customReportOpen.set(
              false,
            );

            /*
             * On ajoute immédiatement le rapport
             * retourné par l'API.
             */
            this.reports.update(
              reports => [
                report,
                ...reports.filter(
                  item =>
                    item.id !==
                    report.id,
                ),
              ],
            );

            /*
             * Puis synchronisation API.
             */
            this.load(
              true,
            );
          },

        error:
          error => {
            this.customReportError.set(
              error?.error?.message ??
                'Impossible de générer le rapport personnalisé.',
            );
          },
      });
  }

  /*
  |--------------------------------------------------------------------------
  | Download
  |--------------------------------------------------------------------------
  */

  open(
    report:
      ProjectReport,
  ):
    void {
    if (
      !this.canExportReports() ||
      report.status !==
        'READY'
    ) {
      return;
    }

    this.downloadingId.set(
      report.id,
    );

    this.service
      .download(
        this.organizationId,
        this.projectId,
        report.id,
      )
      .pipe(
        finalize(
          () =>
            this.downloadingId
              .set(
                null,
              ),
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe({
        next:
          payload => {
            this.service.save(
              payload,
            );
          },

        error:
          error => {
            this.loadError.set(
              error?.error?.message ??
                'Impossible de télécharger ce rapport.',
            );
          },
      });
  }

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  isProcessing(
    report:
      ProjectReport,
  ):
    boolean {
    return [
      'PENDING',
      'PROCESSING',
      'GENERATING',
    ]
      .includes(
        report.status,
      );
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
      READY:
        'Disponible',

      GENERATING:
        'Génération',

      PROCESSING:
        'Génération',

      PENDING:
        'En attente',

      FAILED:
        'Échec',

      EXPIRED:
        'Expiré',
    };

    return (
      labels[
        status
      ] ??
      status
    );
  }

  formatLabel(
    format:
      string,
  ):
    string {
    return format;
  }

  fileSize(
    bytes:
      number |
      null,
  ):
    string {
    if (
      bytes ===
        null ||
      bytes ===
        undefined
    ) {
      return '—';
    }

    if (
      bytes <
      1024
    ) {
      return `${bytes} B`;
    }

    if (
      bytes <
      1024 *
        1024
    ) {
      return `${(
        bytes /
        1024
      ).toFixed(
        1,
      )} KB`;
    }

    return `${(
      bytes /
      1024 /
      1024
    ).toFixed(
      2,
    )} MB`;
  }

  userName(
    report:
      ProjectReport,
  ):
    string {
    const fullName =
      [
        report.requestedBy
          ?.firstName,

        report.requestedBy
          ?.lastName,
      ]
        .filter(
          Boolean,
        )
        .join(
          ' ',
        )
        .trim();

    return (
      fullName ||
      report.requestedBy
        ?.email ||
      'Utilisateur'
    );
  }

  defaultFromDate():
    string {
    const date =
      new Date();

    date.setDate(
      1,
    );

    return this.toInputDate(
      date,
    );
  }

  defaultToDate():
    string {
    return this.toInputDate(
      new Date(),
    );
  }

  private toInputDate(
    date:
      Date,
  ):
    string {
    const year =
      date.getFullYear();

    const month =
      String(
        date.getMonth() +
        1,
      )
        .padStart(
          2,
          '0',
        );

    const day =
      String(
        date.getDate(),
      )
        .padStart(
          2,
          '0',
        );

    return `${year}-${month}-${day}`;
  }
}
