import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  ActivatedRoute,
} from '@angular/router';

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
} from '../../reports.service';

@Component({
  selector:
    'app-organization-reports',

  standalone:
    true,

  imports: [
    CommonModule,
  ],

  templateUrl:
    './organization-reports.component.html',

  styleUrl:
    './organization-reports.component.scss',
})
export class OrganizationReportsComponent {

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

  readonly organizationId =
    this.route.snapshot
      .paramMap
      .get(
        'organizationId',
      )!;

  readonly loading =
    signal(
      false,
    );

  readonly reports =
    signal<
      ProjectReport[]
    >(
      [],
    );

  readonly modalOpen =
    signal(
      false,
    );

  readonly generating =
    signal(
      false,
    );

  readonly downloadingId =
    signal<
      string |
      null
    >(
      null,
    );

  readonly fromDate =
    signal(
      '',
    );

  readonly toDate =
    signal(
      '',
    );

  readonly format =
    signal<ReportFormat>(
      'PDF',
    );

  readonly error =
    signal<
      string |
      null
    >(
      null,
    );

  readonly canRead =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS
              .ORGANIZATION_REPORT_READ,
          ),
    );

  readonly canExport =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS
              .ORGANIZATION_REPORT_EXPORT,
          ),
    );

  constructor() {
    this.load();
  }

  load():
    void {

    if (
      !this.canRead()
    ) {
      this.reports.set(
        [],
      );

      return;
    }

    this.loading.set(
      true,
    );

    this.service
      .listOrganization(
        this.organizationId,
      )
      .subscribe({
        next:
          response => {

            this.reports.set(
              response.data,
            );

            this.loading.set(
              false,
            );
          },

        error:
          error => {

            this.loading.set(
              false,
            );

            this.error.set(
              error?.error?.message ??
              'Impossible de charger les rapports de l’organisation.',
            );
          },
      });
  }

  openCreate():
    void {

    if (
      !this.canExport()
    ) {
      this.error.set(
        "Vous n'avez pas la permission de générer un rapport organisation.",
      );

      return;
    }

    if (
      !this.fromDate()
    ) {
      this.fromDate.set(
        this.defaultFromDate(),
      );
    }

    if (
      !this.toDate()
    ) {
      this.toDate.set(
        this.defaultToDate(),
      );
    }

    this.error.set(
      null,
    );

    this.modalOpen.set(
      true,
    );
  }

  closeCreate():
    void {

    if (
      this.generating()
    ) {
      return;
    }

    this.modalOpen.set(
      false,
    );
  }

  generate():
    void {

    if (
      !this.canExport()
    ) {
      return;
    }

    const fromDate =
      this.fromDate();

    const toDate =
      this.toDate();

    if (
      !fromDate ||
      !toDate
    ) {
      this.error.set(
        'Veuillez sélectionner les deux dates.',
      );

      return;
    }

    if (
      fromDate >
      toDate
    ) {
      this.error.set(
        'La date de début doit être antérieure ou égale à la date de fin.',
      );

      return;
    }

    this.generating.set(
      true,
    );

    this.error.set(
      null,
    );

    this.service
      .createOrganization(
        this.organizationId,
        fromDate,
        toDate,
        this.format(),
      )
      .subscribe({
        next:
          () => {

            this.generating.set(
              false,
            );

            this.modalOpen.set(
              false,
            );

            this.load();
          },

        error:
          error => {

            this.generating.set(
              false,
            );

            this.error.set(
              error?.error?.message ??
              'Impossible de générer le rapport organisation.',
            );
          },
      });
  }

  download(
    report:
      ProjectReport,
  ):
    void {

    if (
      !this.canRead() ||
      report.status !==
        'READY'
    ) {
      return;
    }

    this.downloadingId.set(
      report.id,
    );

    this.service
      .downloadOrganization(
        this.organizationId,
        report.id,
      )
      .subscribe({
        next:
          payload => {

            this.service.save(
              payload,
            );

            this.downloadingId.set(
              null,
            );
          },

        error:
          () => {

            this.downloadingId.set(
              null,
            );
          },
      });
  }

  private defaultFromDate():
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

  private defaultToDate():
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
      ).padStart(
        2,
        '0',
      );

    const day =
      String(
        date.getDate(),
      ).padStart(
        2,
        '0',
      );

    return `${year}-${month}-${day}`;
  }
}
