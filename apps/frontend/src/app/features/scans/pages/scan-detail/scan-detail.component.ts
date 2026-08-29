import {
  Component,
  OnDestroy,
  OnInit,
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
  ScanProgress,
} from '../../models/scan.models';

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
    inject(Router);

  private readonly scans =
    inject(
      ScansService,
    );

  private readonly progressService =
    inject(
      ScanProgressService,
    );

  private readonly destroy$ =
    new Subject<void>();

  private terminalReloaded = false;

  readonly progress =
    signal<
      ScanProgress |
      null
    >(
      null,
    );

  readonly detail =
    signal<any | null>(
      null,
    );

  readonly cancelling =
    signal(false);

  readonly error =
    signal<string | null>(
      null,
    );

  organizationId =
    '';

  projectId =
    '';

  scanId =
    '';

  ngOnInit(): void {
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
        next: (
          progress,
        ) => {
          this.progress.set(
            progress,
          );

          if (
            this.isTerminal(
              progress.status,
            )&&
            !this.terminalReloaded
          ) {
          this.terminalReloaded =
            true;
          }
        },

        error: () => {
          this.error.set(
            'Impossible de suivre la progression du scan.',
          );
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDetail(): void {
    this.scans
      .getScan(
        this.organizationId,
        this.projectId,
        this.scanId,
      )
      .subscribe({
        next: (
          detail,
        ) => {
          this.detail.set(
            detail,
          );
        },
      });
  }

  cancel(): void {
    if (
      this.cancelling()
    ) {
      return;
    }

    this.cancelling.set(
      true,
    );

    this.scans
      .cancel(
        this.organizationId,
        this.projectId,
        this.scanId,
      )
      .subscribe({
        next: () => {
          this.cancelling.set(
            false,
          );
        },

        error: () => {
          this.cancelling.set(
            false,
          );

          this.error.set(
            'Impossible d’annuler le scan.',
          );
        },
      });
  }

  viewFindings(): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'findings',
    ], {
      queryParams: {
        scanId:
          this.scanId,
      },
    });
  }

  isTerminal(
    status:
      string,
  ): boolean {
    return [
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ].includes(
      status,
    );
  }

  canCancel(): boolean {
    const status =
      this.progress()
        ?.status;

    if (!status) {
      return false;
    }

    return !this.isTerminal(
      status,
    );
  }
}
