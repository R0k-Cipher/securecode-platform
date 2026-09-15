import { CommonModule } from '@angular/common';

import { Component, computed, inject, signal } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';

import { AuthContextService } from '../../../../core/auth/auth-context.service';

import { PERMISSIONS } from '../../../../core/auth/auth-context.models';

import { SecurityDashboardService } from '../../services/security-dashboard.service';

import type {
  DashboardFinding,
  DashboardScan,
  SecurityDashboard,
  SecurityIntelligence,
} from '../../models/security-dashboard.models';

@Component({
  selector: 'app-security-dashboard',

  standalone: true,

  imports: [CommonModule],

  templateUrl: './security-dashboard.component.html',

  styleUrl: './security-dashboard.component.scss',
})
export class SecurityDashboardComponent {
  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  private readonly service = inject(SecurityDashboardService);

  private readonly authContext = inject(AuthContextService);

  readonly organizationId =
    this.route.snapshot.paramMap.get('organizationId') ?? '';

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';

  readonly data = signal<SecurityDashboard | null>(null);

  readonly intelligence = signal<SecurityIntelligence | null>(null);

  readonly hasCweData = computed(() => (this.data()?.cwe?.length ?? 0) > 0);

  maxCwe(): number {
    const values = this.data()?.cwe?.map((item) => item.count) ?? [];

    return Math.max(...values, 1);
  }

  readonly loading = signal(true);

  readonly error = signal<string | null>(null);

  /*
  |--------------------------------------------------------------------------
  | Permissions
  |--------------------------------------------------------------------------
  */

  readonly canReadRepositories = computed(() =>
    this.authContext.canProject(this.projectId, PERMISSIONS.REPOSITORY_READ),
  );

  readonly canReadScans = computed(() =>
    this.authContext.canProject(this.projectId, PERMISSIONS.SCAN_READ),
  );

  readonly canReadFindings = computed(() =>
    this.authContext.canProject(this.projectId, PERMISSIONS.FINDING_READ),
  );

  readonly canReadReports = computed(() =>
    this.authContext.canProject(this.projectId, PERMISSIONS.REPORT_READ),
  );

  /*
  |--------------------------------------------------------------------------
  | Dashboard state
  |--------------------------------------------------------------------------
  */

  readonly hasSecurityData = computed(() => {
    const dashboard = this.data();

    if (!dashboard) {
      return false;
    }

    return (
      dashboard.summary.scans > 0 ||
      dashboard.summary.findings > 0 ||
      dashboard.summary.repositories > 0 ||
      dashboard.scoreHistory.length > 0 ||
      dashboard.owasp.length > 0
    );
  });

  readonly hasScoreHistory = computed(
    () => (this.data()?.scoreHistory.length ?? 0) > 0,
  );

  readonly hasOwaspData = computed(() => (this.data()?.owasp.length ?? 0) > 0);

  readonly severityTotal = computed(() => {
    const severity = this.data()?.severity;

    if (!severity) {
      return 0;
    }

    return (
      severity.CRITICAL +
      severity.HIGH +
      severity.MEDIUM +
      severity.LOW +
      severity.INFO
    );
  });

  readonly criticalAndHigh = computed(() => {
    const severity = this.data()?.severity;

    if (!severity) {
      return 0;
    }

    return severity.CRITICAL + severity.HIGH;
  });

  constructor() {
    this.load();
  }

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  load(): void {
    if (!this.organizationId || !this.projectId) {
      this.loading.set(false);

      this.error.set('Organisation ou projet introuvable.');

      return;
    }

    this.loading.set(true);

    this.error.set(null);

    this.service.getDashboard(this.organizationId, this.projectId).subscribe({
      next: (dashboard) => {
        this.data.set(dashboard);

        this.loading.set(false);
      },

      error: (error) => {
        this.loading.set(false);

        this.data.set(null);

        this.error.set(
          error?.error?.message ??
            'Impossible de charger le dashboard de sécurité.',
        );
      },
    });

    this.service
      .getIntelligence(this.organizationId, this.projectId)
      .subscribe({
        next: (intelligence) => this.intelligence.set(intelligence),
        error: () => this.intelligence.set(null),
      });
  }

  /*
  |--------------------------------------------------------------------------
  | Navigation
  |--------------------------------------------------------------------------
  */

  go(
    path: 'repositories' | 'scans' | 'findings' | 'reports',

    queryParams?: Record<string, string>,
  ): void {
    void this.router.navigate(
      ['/organizations', this.organizationId, 'projects', this.projectId, path],
      {
        queryParams,
      },
    );
  }

  goToOrganizationDashboard(): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'dashboard',
    ]);
  }

  openFinding(findingId: string): void {
    if (!this.canReadFindings()) {
      return;
    }

    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'findings',
      findingId,
    ]);
  }

  openScan(scanId: string): void {
    if (!this.canReadScans()) {
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

  openAttackPathFinding(findingIds: string[]): void {
    const findingId = findingIds?.[0];
    if (findingId) this.openFinding(findingId);
  }

  /*
  |--------------------------------------------------------------------------
  | Dashboard helpers
  |--------------------------------------------------------------------------
  */

  cwePercentage(count: number): number {
    return Math.max(4, Math.round((count / this.maxCwe()) * 100));
  }

  maxOwasp(): number {
    const values = this.data()?.owasp?.map((item) => item.count) ?? [];

    return Math.max(...values, 1);
  }

  owaspPercentage(count: number): number {
    return Math.max(4, Math.round((count / this.maxOwasp()) * 100));
  }

  scoreBarHeight(score: number | null): number {
    if (score === null) {
      return 3;
    }

    return Math.max(3, Math.min(100, score));
  }

  severityPercentage(value: number): number {
    const total = this.severityTotal();

    if (total === 0) {
      return 0;
    }

    return Math.round((value / total) * 100);
  }

  findingAssignee(finding: DashboardFinding): string {
    const user = finding.assignments?.[0]?.assignedTo;

    if (!user) {
      return 'Non assigné';
    }

    const fullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return fullName || user.email || 'Assigné';
  }

  repositoryName(scan: DashboardScan): string {
    return scan.repository.fullName || scan.repository.name;
  }

  scanStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      QUEUED: 'En attente',

      PREPARING: 'Préparation',

      DOWNLOADING: 'Téléchargement',

      DETECTING: 'Détection',

      SCANNING: 'Analyse',

      PROCESSING_RESULTS: 'Traitement',

      CALCULATING_SCORE: 'Calcul du score',

      GENERATING_REPORT: 'Rapport',

      COMPLETED: 'Terminé',

      FAILED: 'Échec',

      CANCELLED: 'Annulé',
    };

    return labels[status] ?? status;
  }

  triggerLabel(trigger: string): string {
    const labels: Record<string, string> = {
      MANUAL: 'Manuel',

      PUSH: 'Push',

      PULL_REQUEST: 'Pull Request',

      RELEASE: 'Release',

      SCHEDULED: 'Planifié',

      API: 'API',
    };

    return labels[trigger] ?? trigger;
  }
}
