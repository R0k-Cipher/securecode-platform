import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  PlatformAdminService,
} from '../../platform-admin.service';

type AdminTab =
  | 'overview'
  | 'users'
  | 'organizations'
  | 'logs';

@Component({
  selector:
    'app-admin-dashboard',

  standalone:
    true,

  imports: [
    CommonModule,
  ],

  templateUrl:
    './admin-dashboard.component.html',

  styleUrl:
    './admin-dashboard.component.scss',
})
export class AdminDashboardComponent
implements OnInit {

  private readonly service =
    inject(
      PlatformAdminService,
    );

  readonly loading =
    signal(true);

  readonly data =
    signal<any | null>(
      null,
    );

  readonly users =
    signal<any[]>(
      [],
    );

  readonly orgs =
    signal<any[]>(
      [],
    );

  readonly logs =
    signal<any[]>(
      [],
    );

  readonly tab =
    signal<AdminTab>(
      'overview',
    );

  readonly metrics =
    computed(
      () => {
        const summary =
          this.data()
            ?.summary;

        if (!summary) {
          return [];
        }

        return [
          {
            label:
              'Utilisateurs',
            value:
              summary.users ?? 0,
            helper:
              `${summary.activeUsers ?? 0} actifs`,
          },

          {
            label:
              'Organisations',
            value:
              summary.organizations ?? 0,
            helper:
              'Tenants enregistrés',
          },

          {
            label:
              'Projets',
            value:
              summary.projects ?? 0,
            helper:
              'Projets supervisés',
          },

          {
            label:
              'Repositories',
            value:
              summary.repositories ?? 0,
            helper:
              'Sources connectées',
          },

          {
            label:
              'Scans',
            value:
              summary.scans ?? 0,
            helper:
              `${summary.failedScans ?? 0} en échec`,
          },

          {
            label:
              'Findings',
            value:
              summary.findings ?? 0,
            helper:
              'Détections cumulées',
          },

          {
            label:
              'Critical Open',
            value:
              summary.criticalOpen ?? 0,
            helper:
              'À traiter en priorité',
            critical:
              true,
          },
        ];
      },
    );

  ngOnInit():
    void {
    this.refresh();
  }

  refresh():
    void {
    this.loading.set(
      true,
    );

    this.service
      .dashboard()
      .subscribe({
        next: (
          response,
        ) => {
          this.data.set(
            response,
          );

          this.loading.set(
            false,
          );
        },

        error: () => {
          this.loading.set(
            false,
          );
        },
      });

    this.service
      .users()
      .subscribe(
        (
          response,
        ) =>
          this.users.set(
            response,
          ),
      );

    this.service
      .organizations()
      .subscribe(
        (
          response,
        ) =>
          this.orgs.set(
            response,
          ),
      );

    this.service
      .auditLogs()
      .subscribe(
        (
          response,
        ) =>
          this.logs.set(
            response,
          ),
      );
  }

  setTab(
    tab: AdminTab,
  ):
    void {
    this.tab.set(
      tab,
    );
  }

  toggleUser(
    user: any,
  ):
    void {
    const status =
      user.status ===
      'ACTIVE'
        ? 'SUSPENDED'
        : 'ACTIVE';

    this.service
      .setStatus(
        user.id,
        status,
      )
      .subscribe(
        () =>
          this.refresh(),
      );
  }

  statusClass(
    status: string,
  ):
    string {
    if (
      status ===
      'ACTIVE'
    ) {
      return 'success';
    }

    if (
      status ===
      'SUSPENDED' ||
      status ===
      'DISABLED'
    ) {
      return 'danger';
    }

    return 'warning';
  }
}
