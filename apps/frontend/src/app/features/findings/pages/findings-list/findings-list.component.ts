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
  FormsModule,
} from '@angular/forms';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  FindingsService,
} from '../../services/findings.service';

import type {
  FindingListItem,
  FindingSeverity,
  FindingsOverview,
  FindingStatus,
} from '../../models/finding.models';

import {
  AuthContextService,
} from '../../../../core/auth/auth-context.service';

import {
  PERMISSIONS,
} from '../../../../core/auth/auth-context.models';

@Component({
  selector: 'app-findings-list',

  standalone: true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl:
    './findings-list.component.html',

  styleUrl:
    './findings-list.component.scss',
})
export class FindingsListComponent
  implements OnInit
{
  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly findingsService =
    inject(FindingsService);

  private readonly authContext =
    inject(
      AuthContextService,
    );

  readonly canReadFindings =
  computed(
    () =>
      Boolean(
        this.projectId &&
        this.authContext.canProject(
          this.projectId,
          PERMISSIONS.FINDING_READ,
        ),
      ),
  );

  readonly canUpdateFindings =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext.canProject(
            this.projectId,
            PERMISSIONS.FINDING_UPDATE,
          ),
        ),
    );

  readonly canAssignFindings =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext.canProject(
            this.projectId,
            PERMISSIONS.FINDING_ASSIGN,
          ),
        ),
    );

  readonly findings =
    signal<FindingListItem[]>([]);

  readonly overview =
    signal<FindingsOverview | null>(
      null,
    );

  readonly loading =
    signal(false);

  readonly error =
    signal<string | null>(null);

  organizationId = '';
  projectId = '';

  scanId: string | null =
    null;

  page = 1;
  totalPages = 1;
  total = 0;

  search = '';

  severity:
    FindingSeverity | '' =
    '';

  status:
    FindingStatus | '' =
    '';

  ngOnInit(): void {
    this.organizationId =
      this.route.snapshot.paramMap.get(
        'organizationId',
      ) ?? '';

    this.projectId =
      this.route.snapshot.paramMap.get(
        'projectId',
      ) ?? '';

    this.scanId =
      this.route.snapshot.queryParamMap.get(
        'scanId',
      );

    this.loadOverview();
    this.load();
  }

  load(): void {
    if (
      !this.organizationId ||
      !this.projectId
    ) {
      return;
    }

    if (
      !this.canReadFindings()
    ) {
      this.findings.set(
        [],
      );

      this.error.set(
        "Vous n'avez pas la permission de consulter les findings de ce projet.",
      );

      return;
    }

    this.loading.set(true);
    this.error.set(null);

    const request =
      this.scanId
        ? this.findingsService.listByScan(
            this.organizationId,
            this.projectId,
            this.scanId,
            {
              page:
                this.page,

              severity:
                this.severity ||
                undefined,

              status:
                this.status ||
                undefined,

              search:
                this.search.trim() ||
                undefined,
            },
          )
        : this.findingsService.list(
            this.organizationId,
            this.projectId,
            {
              page:
                this.page,

              severity:
                this.severity ||
                undefined,

              status:
                this.status ||
                undefined,

              search:
                this.search.trim() ||
                undefined,
            },
          );

    request.subscribe({
      next: (response) => {
        this.findings.set(
          response.items,
        );

        this.totalPages =
          response.pagination.totalPages;

        this.total =
          response.pagination.total;

        this.loading.set(false);
      },

      error: (error) => {
        this.loading.set(false);

        this.error.set(
          error?.error?.message ??
            'Impossible de charger les findings.',
        );
      },
    });
  }

  loadOverview(): void {
    this.findingsService
      .overview(
        this.organizationId,
        this.projectId,
      )
      .subscribe({
        next: (overview) => {
          this.overview.set(
            overview,
          );
        },
      });
  }

  applyFilters(): void {
    this.page = 1;
    this.load();
  }

  resetFilters(): void {
    this.search = '';
    this.severity = '';
    this.status = '';
    this.page = 1;

    this.load();
  }

  previousPage(): void {
    if (this.page <= 1) {
      return;
    }

    this.page -= 1;
    this.load();
  }

  nextPage(): void {
    if (
      this.page >=
      this.totalPages
    ) {
      return;
    }

    this.page += 1;
    this.load();
  }
  
  open(
    finding: FindingListItem,
  ): void {
    if (
      !this.canReadFindings()
    ) {
      this.error.set(
        "Vous n'avez pas la permission de consulter ce finding.",
      );

      return;
    }
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'findings',
      finding.id,
    ]);
  }
}
