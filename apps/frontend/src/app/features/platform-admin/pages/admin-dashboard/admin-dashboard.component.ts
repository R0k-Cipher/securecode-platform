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
  finalize,
} from 'rxjs';

import {
  PlatformAdminService,
} from '../../platform-admin.service';

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
    signal(
      true,
    );

  readonly error =
    signal<
      string |
      null
    >(
      null,
    );

  readonly data =
    signal<
      any |
      null
    >(
      null,
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
              'Projets clients',
          },

          {
            label:
              'Sessions actives',

            value:
              summary.activeSessions ?? 0,

            helper:
              'Sessions non révoquées',
          },

          {
            label:
              'Invitations en attente',

            value:
              summary.pendingInvitations ?? 0,

            helper:
              'Invitations valides',
          },

          {
            label:
              'Connexions Git actives',

            value:
              summary.activeGitConnections ?? 0,

            helper:
              'GitHub / GitLab',
          },

          {
            label:
              'Erreurs Git',

            value:
              summary.gitConnectionErrors ?? 0,

            helper:
              'Connexions à vérifier',

            critical:
              (
                summary
                  .gitConnectionErrors ??
                0
              ) >
              0,
          },

          {
            label:
              'Événements audit 24h',

            value:
              summary.auditEvents24h ?? 0,

            helper:
              'Activité enregistrée',
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

    this.error.set(
      null,
    );

    this.service
      .dashboard()
      .pipe(
        finalize(
          () =>
            this.loading.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          response => {
            this.data.set(
              response,
            );
          },

        error:
          () => {
            this.error.set(
              'Impossible de charger les données de supervision.',
            );
          },
      });
  }

  statusClass(
    status:
      string,
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