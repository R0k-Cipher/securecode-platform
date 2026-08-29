import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  inject,
  signal,
} from '@angular/core';

import {
  ActivatedRoute,
} from '@angular/router';

import {
  ReportsService,
  type ProjectReport,
  type ReportFormat,
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

  private readonly reportsService =
    inject(
      ReportsService,
    );

  readonly organizationId =
    this.route.snapshot.paramMap
      .get(
        'organizationId',
      )!;

  readonly projectId =
    this.route.snapshot.paramMap
      .get(
        'projectId',
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

  readonly creating =
    signal<
      ReportFormat | null
    >(
      null,
    );

  constructor() {
    this.load();
  }

  load():
    void {
    this.loading.set(
      true,
    );

    this.reportsService
      .list(
        this.organizationId,
        this.projectId,
      )
      .subscribe({
        next: (
          response,
        ) => {
          this.reports.set(
            response.data,
          );

          this.loading.set(
            false,
          );
        },

        error: () =>
          this.loading.set(
            false,
          ),
      });
  }

  create(
    format: ReportFormat,
  ):
    void {
    this.creating.set(
      format,
    );

    this.reportsService
      .create(
        this.organizationId,
        this.projectId,
        format,
      )
      .subscribe({
        next: () => {
          this.creating.set(
            null,
          );

          this.load();
        },

        error: () =>
          this.creating.set(
            null,
          ),
      });
  }

  open(
    report: ProjectReport,
  ):
    void {
    this.reportsService
      .download(
        this.organizationId,
        this.projectId,
        report.id,
      )
      .subscribe(
        (
          payload,
        ) => {
          if (
            payload.printAsPdf
          ) {
            const popup =
              window.open(
                '',
                '_blank',
              );

            if (!popup) {
              return;
            }

            popup.document
              .open();

            popup.document
              .write(
                payload.content,
              );

            popup.document
              .close();

            popup.focus();

            setTimeout(
              () =>
                popup.print(),
              300,
            );

            return;
          }

          const blob =
            new Blob(
              [
                payload.content,
              ],
              {
                type:
                  payload.mimeType,
              },
            );

          const url =
            URL.createObjectURL(
              blob,
            );

          const anchor =
            document.createElement(
              'a',
            );

          anchor.href =
            url;

          anchor.download =
            payload.name;

          anchor.click();

          URL.revokeObjectURL(
            url,
          );
        },
      );
  }
}
