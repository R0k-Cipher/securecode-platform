import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  finalize,
} from 'rxjs';

import {
  SecurityDashboardService,
} from '../../services/security-dashboard.service';

import type {
  SecurityDashboardResponse,
} from '../../models/security-dashboard.models';

@Component({
  selector: 'app-security-dashboard',

  standalone: true,

  imports: [
    CommonModule,
  ],

  templateUrl:
    './security-dashboard.component.html',

  styleUrl:
    './security-dashboard.component.scss',
})
export class SecurityDashboardComponent
  implements OnInit
{
  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly dashboardService =
    inject(SecurityDashboardService);

  readonly dashboard =
    signal<SecurityDashboardResponse | null>(
      null,
    );

  readonly loading =
    signal(false);

  readonly error =
    signal<string | null>(null);

  organizationId = '';
  projectId = '';

  ngOnInit(): void {
    this.organizationId =
      this.route.snapshot.paramMap.get(
        'organizationId',
      ) ?? '';

    this.projectId =
      this.route.snapshot.paramMap.get(
        'projectId',
      ) ?? '';

    this.load();
  }

  load(): void {
    if (
      !this.organizationId ||
      !this.projectId
    ) {
      this.error.set(
        'Organisation ou projet introuvable.',
      );

      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.dashboardService
      .getProjectDashboard(
        this.organizationId,
        this.projectId,
      )
      .pipe(
        finalize(() => {
          this.loading.set(false);
        }),
      )
      .subscribe({
        next: (dashboard) => {
          this.dashboard.set(
            dashboard,
          );
        },

        error: (error) => {
          this.error.set(
            error?.error?.message ??
              'Impossible de charger le tableau de bord.',
          );
        },
      });
  }

  openRepositories(): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'repositories',
    ]);
  }

  openFindings(): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'findings',
    ]);
  }

  openRepository(
    repositoryId: string,
  ): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'repositories',
      repositoryId,
    ]);
  }

  openScan(
    scanId: string,
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

  scoreClass(
    score: number | null,
  ): string {
    if (score === null) {
      return 'score-neutral';
    }

    if (score >= 80) {
      return 'score-good';
    }

    if (score >= 60) {
      return 'score-warning';
    }

    return 'score-danger';
  }

  statusClass(
    status: string,
  ): string {
    return `status-${status.toLowerCase()}`;
  }
}
