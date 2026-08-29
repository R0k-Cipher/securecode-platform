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
  finalize,
  takeUntil,
} from 'rxjs';

import {
  RepositoriesService,
} from '../../services/repositories.service';

import {
  ScansService,
} from '../../../scans/services/scans.service';

import type {
  ScanListItem,
} from '../../../scans/models/scan.models';

import {
  getApiErrorMessage,
} from '../../../../core/utils/api-error.util';

@Component({
  selector:
    'app-repository-detail',

  standalone:
    true,

  imports: [
    CommonModule,
  ],

  templateUrl:
    './repository-detail.component.html',

  styleUrl:
    './repository-detail.component.scss',
})
export class RepositoryDetailComponent
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

  private readonly repositories =
    inject(
      RepositoriesService,
    );

  private readonly scans =
    inject(
      ScansService,
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
    >([]);

  readonly loading =
    signal(false);

  readonly startingScan =
    signal(false);

  readonly error =
    signal<string | null>(
      null,
    );

  organizationId =
    '';

  projectId =
    '';

  repositoryId =
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

    this.repositoryId =
      this.route.snapshot
        .paramMap
        .get(
          'repositoryId',
        ) ??
      '';

    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    if (
      !this.organizationId ||
      !this.projectId ||
      !this.repositoryId
    ) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

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
        next: (
          overview,
        ) => {
          this.overview.set(
            overview,
          );
        },

        error: () => {
          this.error.set(
            'Impossible de charger le repository.',
          );
        },
      });

    this.scans
      .listRepositoryScans(
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
        next: (
          result,
        ) => {
          this.scanHistory.set(
            result.items,
          );
        },
      });
  }

  startScan(): void {
    if (
      this.startingScan()
    ) {
      return;
    }

    this.startingScan.set(
      true,
    );

    this.error.set(null);

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
            this.startingScan
              .set(false),
        ),
      )
      .subscribe({
        next: (
          result,
        ) => {
          void this.router.navigate([
            '/organizations',
            this.organizationId,
            'projects',
            this.projectId,
            'scans',
            result.scanId,
          ]);
        },

        error: (
          error,
        ) => {
          this.error.set(
            getApiErrorMessage(
              error,
              '  Impossible de lancer le scan.',
            )
          );
        },
      });
  }

  openScan(
    scanId:
      string,
  ): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'scans',
      scanId,
    ]);
  }

  openFindings(): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'findings',
    ], {
      queryParams: {
        repositoryId:
          this.repositoryId,
      },
    });
  }
}
