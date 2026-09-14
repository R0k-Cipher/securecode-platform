import {
  inject,
} from '@angular/core';

import type {
  CanActivateFn,
} from '@angular/router';

import {
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

export const platformAdminGuard:
  CanActivateFn =
  () => {
    const context =
      inject(
        AuthContextService,
      );

    const router =
      inject(
        Router,
      );

    return context
      .load()
      .pipe(
        map(
          () => {
            if (
              context
                .isPlatformAdmin()
            ) {
              return true;
            }

            const organization =
              context
                .organization();

            if (organization) {
              return router
                .createUrlTree([
                  '/organizations',
                  organization.id,
                  'dashboard',
                ]);
            }

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
