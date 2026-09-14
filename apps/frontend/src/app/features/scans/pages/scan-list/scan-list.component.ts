import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';

import {
  CommonModule,
} from '@angular/common';

import {
  FormsModule,
} from '@angular/forms';

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
  ScansService,
} from '../../services/scans.service';

import type {
  ScanListItem,
  ScanStatus,
} from '../../models/scan.models';

import {
  getApiErrorMessage,
} from '../../../../core/utils/api-error.util';

import {
  scanStatusLabel,
} from '../../../../shared/utils/status-labels';

import {
  AuthContextService,
} from '../../../../core/auth/auth-context.service';

import {
  PERMISSIONS,
} from '../../../../core/auth/auth-context.models';

@Component({
  selector:
    'app-scan-list',

  standalone:
    true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl:
    './scan-list.component.html',

  styleUrl:
    './scan-list.component.scss',
})
export class ScanListComponent
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

  private readonly scansService =
    inject(
      ScansService,
    );

  private readonly destroy$ =
    new Subject<void>();

  readonly scans =
    signal<
      ScanListItem[]
    >([]);

  readonly loading =
    signal(false);

  readonly error =
    signal<
      string | null
    >(null);

  organizationId =
    '';

  projectId =
    '';

  page =
    1;

  total =
    0;

  totalPages =
    1;

  status:
    ScanStatus | '' =
    '';

  readonly statuses:
    ScanStatus[] = [
      'QUEUED',
      'PREPARING',
      'DOWNLOADING',
      'DETECTING',
      'SCANNING',
      'PROCESSING_RESULTS',
      'CALCULATING_SCORE',
      'GENERATING_REPORT',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ];

  ngOnInit():
    void {
    this.organizationId =
      this.route.snapshot
        .paramMap
        .get(
          'organizationId',
        ) ?? '';

    this.projectId =
      this.route.snapshot
        .paramMap
        .get(
          'projectId',
        ) ?? '';

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
      !this.projectId
    ) {
      this.error.set(
        'Organisation ou projet introuvable.',
      );

      return;
    }

    if (
      !this.canReadScans()
    ) {
      this.scans.set(
        [],
      );

      this.error.set(
        "Vous n'avez pas la permission de consulter les scans de ce projet.",
      );

      return;
    }

    this.loading.set(
      true,
    );

    this.error.set(
      null,
    );

    this.scansService
      .listProjectScans(
        this.organizationId,
        this.projectId,
        {
          page:
            this.page,

          perPage:
            20,

          status:
            this.status ||
            undefined,
        },
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
          (
            response,
          ) => {
            this.scans.set(
              response.items,
            );

            this.total =
              response.pagination
                .total;

            this.totalPages =
              Math.max(
                1,
                response.pagination
                  .totalPages,
              );
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              getApiErrorMessage(
                error,
                'Impossible de charger les scans.',
              ),
            );
          },
      });
  }

  filter():
    void {
    this.page =
      1;

    this.load();
  }

  reset():
    void {
    this.status =
      '';

    this.page =
      1;

    this.load();
  }

  previousPage():
    void {
    if (
      this.page <= 1 ||
      this.loading()
    ) {
      return;
    }

    this.page -=
      1;

    this.load();
  }

  nextPage():
    void {
    if (
      this.page >=
        this.totalPages ||
      this.loading()
    ) {
      return;
    }

    this.page +=
      1;

    this.load();
  }

  openScan(
    scan:
      ScanListItem,
  ): void {
    if (
      !this.canReadScans()
    ) {
      this.error.set(
        "Vous n'avez pas la permission de consulter ce scan.",
      );

      return;
    }

    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'scans',
      scan.id,
    ]);
  }

  statusLabel(
    status:
      string,
  ): string {
    return scanStatusLabel(
      status,
    );
  }

private readonly authContext =
  inject(
    AuthContextService,
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

}
