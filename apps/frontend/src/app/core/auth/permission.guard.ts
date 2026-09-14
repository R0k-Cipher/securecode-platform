import {
  inject,
} from '@angular/core';

import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
} from '@angular/router';

import {
  catchError,
  map,
  of,
} from 'rxjs';

import {
  AuthContextService,
} from './auth-context.service';

export const permissionGuard:
  CanActivateFn =
  (
    route:
      ActivatedRouteSnapshot,
  ) => {
    const context =
      inject(
        AuthContextService,
      );

    const router =
      inject(
        Router,
      );

    const permission =
      route.data[
        'permission'
      ] as
        string |
        undefined;

    const scope =
      route.data[
        'permissionScope'
      ] as
        'ORGANIZATION' |
        'PROJECT' |
        undefined;

    const organizationRoles =
      route.data[
        'organizationRoles'
      ] as
        string[] |
        undefined;

    return context
      .load()
      .pipe(
        map(
          () => {
            const organizationId =
              route.paramMap.get(
                'organizationId',
              );

            const projectId =
              route.paramMap.get(
                'projectId',
              );

            /*
            |--------------------------------------------------------------------------
            | PLATFORM ADMIN
            |--------------------------------------------------------------------------
            |
            | PLATFORM_ADMIN ne doit jamais entrer dans
            | l'espace métier d'une organisation cliente.
            |--------------------------------------------------------------------------
            */

            if (
              context
                .isPlatformAdmin()
            ) {
              return router
                .createUrlTree([
                  '/platform-admin',
                ]);
            }

            /*
            |--------------------------------------------------------------------------
            | TENANT ISOLATION
            |--------------------------------------------------------------------------
            */

            if (
              organizationId &&
              !context
                .hasOrganization(
                  organizationId,
                )
            ) {
              return router
                .createUrlTree([
                  '/organizations',
                ]);
            }

            /*
            |--------------------------------------------------------------------------
            | ORGANIZATION SCOPE
            |--------------------------------------------------------------------------
            */

            if (
              scope ===
              'ORGANIZATION'
            ) {
              /*
              |--------------------------------------------------------------------------
              | Optional organization role restriction
              |--------------------------------------------------------------------------
              |
              | Exemple :
              |
              | Dashboard général
              | -> OWNER / ADMIN uniquement
              |--------------------------------------------------------------------------
              */

              if (
                organizationRoles &&
                organizationRoles.length >
                  0
              ) {
                const roleCode =
                  context
                    .organizationRole()
                    ?.code;

                if (
                  !roleCode ||
                  !organizationRoles
                    .includes(
                      roleCode,
                    )
                ) {
                  if (
                    organizationId
                  ) {
                    return router
                      .createUrlTree([
                        '/organizations',
                        organizationId,
                        'projects',
                      ]);
                  }

                  return router
                    .createUrlTree([
                      '/organizations',
                    ]);
                }
              }

              /*
              |--------------------------------------------------------------------------
              | Route organization sans permission particulière
              |--------------------------------------------------------------------------
              */

              if (
                !permission
              ) {
                return true;
              }

              /*
              |--------------------------------------------------------------------------
              | Organization permission
              |--------------------------------------------------------------------------
              */

              if (
                context
                  .canOrganization(
                    permission,
                  )
              ) {
                return true;
              }

              /*
              |--------------------------------------------------------------------------
              | Fallback customer
              |--------------------------------------------------------------------------
              |
              | On ne redirige surtout PAS vers Dashboard général.
              |--------------------------------------------------------------------------
              */

              if (
                organizationId
              ) {
                return router
                  .createUrlTree([
                    '/organizations',
                    organizationId,
                    'projects',
                  ]);
              }

              return router
                .createUrlTree([
                  '/organizations',
                ]);
            }

            /*
            |--------------------------------------------------------------------------
            | PROJECT SCOPE
            |--------------------------------------------------------------------------
            |
            | IMPORTANT :
            |
            | AUCUNE permission organisation n'est vérifiée ici.
            |
            | Le droit vient exclusivement de :
            |
            | ProjectMember
            |     ↓
            | Role PROJECT
            |     ↓
            | permissions du projet
            |--------------------------------------------------------------------------
            */

            if (
              scope ===
              'PROJECT'
            ) {
              if (
                !organizationId ||
                !projectId
              ) {
                return router
                  .createUrlTree([
                    '/organizations',
                  ]);
              }

              /*
              |--------------------------------------------------------------------------
              | Project membership / OWNER override
              |--------------------------------------------------------------------------
              */

              if (
                !context
                  .hasProject(
                    projectId,
                  )
              ) {
                return router
                  .createUrlTree([
                    '/organizations',
                    organizationId,
                    'projects',
                  ]);
              }

              /*
              |--------------------------------------------------------------------------
              | Route projet sans permission spécifique
              |--------------------------------------------------------------------------
              */

              if (
                !permission
              ) {
                return true;
              }

              /*
              |--------------------------------------------------------------------------
              | Project permission
              |--------------------------------------------------------------------------
              */

              if (
                context
                  .canProject(
                    projectId,
                    permission,
                  )
              ) {
                return true;
              }

              return router
                .createUrlTree([
                  '/organizations',
                  organizationId,
                  'projects',
                ]);
            }

            /*
            |--------------------------------------------------------------------------
            | Route sans RBAC spécifique
            |--------------------------------------------------------------------------
            */

            if (
              !permission &&
              !scope
            ) {
              return true;
            }

            /*
            |--------------------------------------------------------------------------
            | Configuration invalide
            |--------------------------------------------------------------------------
            |
            | Une route avec permission mais sans scope explicite
            | est refusée par sécurité.
            |--------------------------------------------------------------------------
            */

            return router
              .createUrlTree([
                '/organizations',
              ]);
          },
        ),

        catchError(
          () =>
            of(
              router
                .createUrlTree([
                  '/login',
                ]),
            ),
        ),
      );
  };
