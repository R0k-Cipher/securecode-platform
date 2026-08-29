import type {
  Routes,
} from '@angular/router';

import {
  authGuard,
} from './core/auth/auth.guard';

import {
  platformAdminGuard,
} from './core/auth/platform-admin.guard';

export const routes:
  Routes = [
  {
    path:
      'login',

    loadComponent:
      () =>
        import(
          './features/auth/pages/login/login.component'
        )
          .then(
            (
              module,
            ) =>
              module
                .LoginComponent,
          ),
  },

  {
    path:
      'register',

    loadComponent:
      () =>
        import(
          './features/auth/pages/register/register.component'
        )
          .then(
            (
              module,
            ) =>
              module
                .RegisterComponent,
          ),
  },

  {
    path:
      'github/callback',

    canActivate: [
      authGuard,
    ],

    loadComponent:
      () =>
        import(
          './features/github/pages/github-callback/github-callback.component'
        )
          .then(
            (
              module,
            ) =>
              module
                .GithubCallbackComponent,
          ),
  },

  {
    path:
      '',

    canActivate: [
      authGuard,
    ],

    loadComponent:
      () =>
        import(
          './layouts/app-layout/app-layout.component'
        )
          .then(
            (
              module,
            ) =>
              module
                .AppLayoutComponent,
          ),

    children: [
      {
        path:
          '',

        pathMatch:
          'full',

        redirectTo:
          'organizations',
      },

      {
        path:
          'organizations',

        loadComponent:
          () =>
            import(
              './features/organizations/pages/organization-list/organization-list.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .OrganizationListComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/members',

        loadComponent:
          () =>
            import(
              './features/organizations/pages/organization-members/organization-members.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .OrganizationMembersComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects',

        loadComponent:
          () =>
            import(
              './features/projects/pages/project-list/project-list.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .ProjectListComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects/:projectId/dashboard',

        loadComponent:
          () =>
            import(
              './features/dashboard/pages/security-dashboard/security-dashboard.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .SecurityDashboardComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects/:projectId/repositories',

        loadComponent:
          () =>
            import(
              './features/repositories/pages/repository-list/repository-list.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .RepositoryListComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects/:projectId/repositories/:repositoryId',

        loadComponent:
          () =>
            import(
              './features/repositories/pages/repository-detail/repository-detail.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .RepositoryDetailComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects/:projectId/github',

        loadComponent:
          () =>
            import(
              './features/github/pages/github-repositories/github-repositories.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .GithubRepositoriesComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects/:projectId/scans',

        loadComponent:
          () =>
            import(
              './features/scans/pages/scan-list/scan-list.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .ScanListComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects/:projectId/scans/:scanId',

        loadComponent:
          () =>
            import(
              './features/scans/pages/scan-detail/scan-detail.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .ScanDetailComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects/:projectId/findings',

        loadComponent:
          () =>
            import(
              './features/findings/pages/findings-list/findings-list.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .FindingsListComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects/:projectId/findings/:findingId',

        loadComponent:
          () =>
            import(
              './features/findings/pages/finding-detail/finding-detail.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .FindingDetailComponent,
              ),
      },

      {
        path:
          'organizations/:organizationId/projects/:projectId/reports',

        loadComponent:
          () =>
            import(
              './features/reports/pages/reports-page/reports-page.component'
            )
              .then(
                (
                  module,
                ) =>
                  module
                    .ReportsPageComponent,
              ),
      },

      {
        path:
          'platform-admin',

        canActivate: [
          platformAdminGuard,
        ],

        children: [
          {
            path:
              '',

            loadComponent:
              () =>
                import(
                  './features/platform-admin/pages/admin-dashboard/admin-dashboard.component'
                )
                  .then(
                    (
                      module,
                    ) =>
                      module
                        .AdminDashboardComponent,
                  ),
          },

          {
            path:
              'users',

            loadComponent:
              () =>
                import(
                  './features/platform-admin/pages/admin-users/admin-users.component'
                )
                  .then(
                    (
                      module,
                    ) =>
                      module
                        .AdminUsersComponent,
                  ),
          },

          {
            path:
              'organizations',

            loadComponent:
              () =>
                import(
                  './features/platform-admin/pages/admin-organizations/admin-organizations.component'
                )
                  .then(
                    (
                      module,
                    ) =>
                      module
                        .AdminOrganizationsComponent,
                  ),
          },

          {
            path:
              'projects',

            loadComponent:
              () =>
                import(
                  './features/platform-admin/pages/admin-projects/admin-projects.component'
                )
                  .then(
                    (
                      module,
                    ) =>
                      module
                        .AdminProjectsComponent,
                  ),
          },

          {
            path:
              'scans',

            loadComponent:
              () =>
                import(
                  './features/platform-admin/pages/admin-scans/admin-scans.component'
                )
                  .then(
                    (
                      module,
                    ) =>
                      module
                        .AdminScansComponent,
                  ),
          },

          {
            path:
              'audit-logs',

            loadComponent:
              () =>
                import(
                  './features/platform-admin/pages/admin-audit-logs/admin-audit-logs.component'
                )
                  .then(
                    (
                      module,
                    ) =>
                      module
                        .AdminAuditLogsComponent,
                  ),
          },

          {
            path:
              'system',

            loadComponent:
              () =>
                import(
                  './features/platform-admin/pages/admin-system/admin-system.component'
                )
                  .then(
                    (
                      module,
                    ) =>
                      module
                        .AdminSystemComponent,
                  ),
          },
        ],
      },

      {
        path:
          'organizations/:organizationId/audit-logs',

        loadComponent:
          () =>
            import(
              './features/organizations/pages/organization-audit-logs/organization-audit-logs.component'
            )
              .then(
                (
                  m,
                ) =>
                  m.OrganizationAuditLogsComponent,
              ),
      },
    ],
  },

  {
    path:
      'invitation',

    loadComponent:
      () =>
        import(
          './features/invitations/invitation-page/invitation-page.component'
        )
          .then(
            (
              m,
            ) =>
              m.InvitationPageComponent,
          ),
  },


  {
    path:
      '**',

    redirectTo:
      '',
  },
];
