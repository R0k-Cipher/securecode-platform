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
  Router,
  RouterLink,
} from '@angular/router';

import {
  ProjectsService,
} from '../../../projects/services/projects.service';

import {
  OrganizationAuditService,
  type OrganizationAuditLog,
} from '../../services/organization-audit.service';

import type {
  Project,
} from '../../../projects/models/project.models';

import {
  forkJoin,
} from 'rxjs';

@Component({
  selector: 'app-organization-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './organization-dashboard.component.html',
  styleUrl: './organization-dashboard.component.scss',
})
export class OrganizationDashboardComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectsService = inject(ProjectsService);
  private readonly auditService = inject(OrganizationAuditService);

  readonly organizationId =
    this.route.snapshot.paramMap.get('organizationId') ?? '';

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly projects = signal<Project[]>([]);
  readonly auditLogs = signal<OrganizationAuditLog[]>([]);

  readonly activeProjects = computed(() =>
    this.projects().filter(project => project.status === 'ACTIVE').length,
  );

  readonly archivedProjects = computed(() =>
    this.projects().filter(project => project.status === 'ARCHIVED').length,
  );

  readonly repositories = computed(() =>
    this.projects().reduce(
      (total, project) => total + (project.repositoriesCount ?? 0),
      0,
    ),
  );

  readonly scans = computed(() =>
    this.projects().reduce(
      (total, project) => total + (project.scansCount ?? 0),
      0,
    ),
  );

  readonly findings = computed(() =>
    this.projects().reduce(
      (total, project) => total + (project.findingsCount ?? 0),
      0,
    ),
  );

  readonly vulnerabilities = computed(() =>
    this.projects().reduce(
      (total, project) => total + (project.vulnerabilitiesCount ?? 0),
      0,
    ),
  );

  readonly reports = computed(() =>
    this.projects().reduce(
      (total, project) => total + (project.reportsCount ?? 0),
      0,
    ),
  );

  readonly correctionsThisMonth = computed(() =>
    this.auditLogs().filter(log =>
      this.isCurrentMonth(log.createdAt) &&
      this.isFindingCorrection(log),
    ),
  );

  readonly correctionsCount = computed(() =>
    this.correctionsThisMonth().length,
  );

  readonly recentActivity = computed(() =>
    [...this.auditLogs()]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      )
      .slice(0, 8),
  );

  readonly projectsWithFindings = computed(() =>
    [...this.projects()]
      .filter(project => (project.findingsCount ?? 0) > 0)
      .sort((a, b) => (b.findingsCount ?? 0) - (a.findingsCount ?? 0))
      .slice(0, 8),
  );

  constructor() {
    this.load();
  }

  load(): void {
    if (!this.organizationId) {
      this.loading.set(false);
      this.error.set('Organisation introuvable.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      projects: this.projectsService.list(this.organizationId, { page: 1, limit: 100 }),
      audit: this.auditService.list(this.organizationId),
    }).subscribe({
      next: response => {
        this.projects.set(response.projects.data);
        this.auditLogs.set(response.audit.data);
        this.loading.set(false);
      },
      error: error => {
        this.loading.set(false);
        this.error.set(
          Array.isArray(error?.error?.message)
            ? error.error.message.join(' ')
            : error?.error?.message ??
              'Impossible de charger le dashboard de l’organisation.',
        );
      },
    });
  }

  isCurrentMonth(value: string): boolean {
    const date = new Date(value);
    const now = new Date();

    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  isFindingCorrection(log: OrganizationAuditLog): boolean {
    const action = `${log.action} ${log.description ?? ''}`.toLowerCase();

    if (!log.resourceType.toLowerCase().includes('finding')) {
      return false;
    }

    return /fix|fixed|corrig|resolved|resolve|closed|close|remedi/.test(action);
  }

  activityLabel(log: OrganizationAuditLog): string {
    if (this.isFindingCorrection(log)) {
      return 'Vulnérabilité corrigée';
    }

    return log.description ?? log.action;
  }

  openProject(project: Project): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      project.id,
      'dashboard',
    ]);
  }
}
