import type {
  Routes,
} from '@angular/router';

import {
  authGuard,
} from './core/auth/auth.guard';

import {
  platformAdminGuard,
} from './core/auth/platform-admin.guard';

import {
  permissionGuard,
} from './core/auth/permission.guard';

import {
  PERMISSIONS,
} from './core/auth/auth-context.models';

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

        /*
        |--------------------------------------------------------------------------
        | Organizations
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.ORGANIZATION_READ,

            permissionScope:
              'ORGANIZATION',
          },

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
            'organizations/:organizationId/dashboard',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.ORGANIZATION_READ,

            permissionScope:
              'ORGANIZATION',

            organizationRoles: [
              'OWNER',
              'ADMIN',
            ],
          },

          loadComponent:
            () =>
              import(
                './features/organizations/pages/organization-dashboard/organization-dashboard.component'
              )
                .then(
                  (
                    module,
                  ) =>
                    module
                      .OrganizationDashboardComponent,
                ),
        },

        /*
        |--------------------------------------------------------------------------
        | Organization Members
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations/:organizationId/members',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.MEMBER_READ,

            permissionScope:
              'ORGANIZATION',
          },

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

        /*
        |--------------------------------------------------------------------------
        | Projects
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations/:organizationId/projects',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.PROJECT_LIST,

            permissionScope:
              'ORGANIZATION',
          },

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

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.PROJECT_READ,

            permissionScope:
              'PROJECT',
          },

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
            'organizations/:organizationId/projects/:projectId/members',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.PROJECT_MEMBER_READ,

            permissionScope:
              'PROJECT',
          },

          loadComponent:
            () =>
              import(
                './features/projects/pages/project-members/project-members.component'
              )
                .then(
                  (
                    module,
                  ) =>
                    module
                      .ProjectMembersComponent,
                ),
        },

        /*
        |--------------------------------------------------------------------------
        | Repositories
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations/:organizationId/projects/:projectId/repositories',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.REPOSITORY_READ,

            permissionScope:
              'PROJECT',
          },

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

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.REPOSITORY_READ,

            permissionScope:
              'PROJECT',
          },

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

        /*
        |--------------------------------------------------------------------------
        | GitHub
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations/:organizationId/projects/:projectId/github',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.GIT_CONNECTION_READ,

            permissionScope:
              'PROJECT',
          },

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

        /*
        |--------------------------------------------------------------------------
        | Scans
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations/:organizationId/projects/:projectId/scans',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.SCAN_READ,

            permissionScope:
              'PROJECT',
          },

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

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.SCAN_READ,

            permissionScope:
              'PROJECT',
          },

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

        /*
        |--------------------------------------------------------------------------
        | Findings
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations/:organizationId/projects/:projectId/findings',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.FINDING_READ,

            permissionScope:
              'PROJECT',
          },

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

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.FINDING_READ,

            permissionScope:
              'PROJECT',
          },

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

        /*
        |--------------------------------------------------------------------------
        | My Tasks
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations/:organizationId/projects/:projectId/my-tasks',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.FINDING_READ,

            permissionScope:
              'PROJECT',
          },

          loadComponent:
            () =>
              import(
                './features/findings/pages/my-tasks/my-tasks.component'
              )
                .then(
                  (
                    module,
                  ) =>
                    module
                      .MyTasksComponent,
                ),
        },

        /*
        |--------------------------------------------------------------------------
        | Reports
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations/:organizationId/projects/:projectId/reports',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.REPORT_READ,

            permissionScope:
              'PROJECT',
          },

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

        /*
        |--------------------------------------------------------------------------
        | Organization Audit Logs
        |--------------------------------------------------------------------------
        */

        {
          path:
            'organizations/:organizationId/audit-logs',

          canActivate: [
            permissionGuard,
          ],

          data: {
            permission:
              PERMISSIONS.AUDIT_LOG_READ,

            permissionScope:
              'ORGANIZATION',
          },

          loadComponent:
            () =>
              import(
                './features/organizations/pages/organization-audit-logs/organization-audit-logs.component'
              )
                .then(
                  (
                    module,
                  ) =>
                    module
                      .OrganizationAuditLogsComponent,
                ),
        },

        /*
        |--------------------------------------------------------------------------
        | Platform Administration
        |--------------------------------------------------------------------------
        */

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
      ],
    },

    /*
    |--------------------------------------------------------------------------
    | Invitation
    |--------------------------------------------------------------------------
    */

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
                module,
              ) =>
                module
                  .InvitationPageComponent,
            ),
    },

    /*
    |--------------------------------------------------------------------------
    | Fallback
    |--------------------------------------------------------------------------
    */

    {
      path:
        '**',

      redirectTo:
        '',
    },
  ];
