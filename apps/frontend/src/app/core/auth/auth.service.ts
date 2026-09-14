import {
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  Router,
} from '@angular/router';

import {
  Observable,
  catchError,
  map,
  of,
  switchMap,
  tap,
  throwError,
} from 'rxjs';

import {
  ApiClientService,
} from '../api/api-client.service';

import {
  TokenStorageService,
} from '../storage/token-storage.service';

import {
  AuthContextService,
} from './auth-context.service';

import type {
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
} from './auth.models';

@Injectable({
  providedIn:
    'root',
})
export class AuthService {
  private readonly api =
    inject(
      ApiClientService,
    );

  private readonly tokens =
    inject(
      TokenStorageService,
    );

  private readonly router =
    inject(
      Router,
    );

  private readonly authContext =
    inject(
      AuthContextService,
    );

  private readonly currentUserState =
    signal<
      AuthenticatedUser |
      null
    >(
      null,
    );

  private readonly initializedState =
    signal(
      false,
    );

  readonly currentUser =
    this.currentUserState
      .asReadonly();

  readonly initialized =
    this.initializedState
      .asReadonly();

  readonly authenticated =
    computed(
      () =>
        Boolean(
          this.tokens
            .getAccessToken(),
        ),
    );

  constructor() {
    this.restoreSession();
  }

  /*
  |--------------------------------------------------------------------------
  | Restore session
  |--------------------------------------------------------------------------
  */

  restoreSession():
    void {
    const token =
      this.tokens
        .getAccessToken();

    if (!token) {
      this.currentUserState.set(
        null,
      );

      this.authContext.clear();

      this.initializedState.set(
        true,
      );

      return;
    }

    this.api
      .get<AuthenticatedUser>(
        '/auth/me',
      )
      .pipe(
        switchMap(
          user => {
            this.currentUserState.set(
              user,
            );

            return this.authContext
              .load(
                true,
              )
              .pipe(
                map(
                  () =>
                    user,
                ),
              );
          },
        ),

        catchError(
          () => {
            this.tokens.clear();

            this.authContext.clear();

            this.currentUserState.set(
              null,
            );

            return of(
              null,
            );
          },
        ),
      )
      .subscribe(
        () => {
          this.initializedState.set(
            true,
          );
        },
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Login
  |--------------------------------------------------------------------------
  */

  login(
    request:
      LoginRequest,
  ): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse>(
        '/auth/login',
        request,
      )
      .pipe(
        tap(
          response => {
            this.storeTokens(
              response.accessToken,
              response.refreshToken,
            );

            this.currentUserState.set(
              response.user,
            );
          },
        ),

        switchMap(
          response =>
            this.authContext
              .load(
                true,
              )
              .pipe(
                map(
                  () =>
                    response,
                ),
              ),
        ),

        tap(
          () => {
            this.initializedState.set(
              true,
            );
          },
        ),

        catchError(
          error => {
            this.clearLocalSession();

            return throwError(
              () =>
                error,
            );
          },
        ),
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Register
  |--------------------------------------------------------------------------
  */

  register(
    request:
      RegisterRequest,
  ): Observable<RegisterResponse> {
    return this.api
      .post<RegisterResponse>(
        '/auth/register',
        request,
      )
      .pipe(
        tap(
          response => {
            this.storeTokens(
              response.accessToken,
              response.refreshToken,
            );

            this.currentUserState.set(
              response.user,
            );
          },
        ),

        switchMap(
          response =>
            this.authContext
              .load(
                true,
              )
              .pipe(
                map(
                  () =>
                    response,
                ),
              ),
        ),

        tap(
          () => {
            this.initializedState.set(
              true,
            );
          },
        ),

        catchError(
          error => {
            this.clearLocalSession();

            return throwError(
              () =>
                error,
            );
          },
        ),
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Logout current session
  |--------------------------------------------------------------------------
  */

  logout():
    void {
    const accessToken =
      this.tokens
        .getAccessToken();

    if (accessToken) {
      this.api
        .post<void>(
          '/auth/logout',
          {},
        )
        .pipe(
          catchError(
            () =>
              of(
                undefined,
              ),
          ),
        )
        .subscribe();
    }

    this.clearLocalSession();

    void this.router.navigate([
      '/login',
    ]);
  }

  /*
  |--------------------------------------------------------------------------
  | Logout every session for current identity
  |--------------------------------------------------------------------------
  */

  logoutAll():
    void {
    this.api
      .post<void>(
        '/auth/logout-all',
        {},
      )
      .pipe(
        catchError(
          () =>
            of(
              undefined,
            ),
        ),
      )
      .subscribe(
        () => {
          this.clearLocalSession();

          void this.router.navigate([
            '/login',
          ]);
        },
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Helpers
  |--------------------------------------------------------------------------
  */

  private storeTokens(
    accessToken:
      string,

    refreshToken:
      string,
  ):
    void {
    this.tokens
      .setAccessToken(
        accessToken,
      );

    this.tokens
      .setRefreshToken(
        refreshToken,
      );
  }

  private clearLocalSession():
    void {
    this.tokens.clear();

    this.authContext.clear();

    this.currentUserState.set(
      null,
    );

    this.initializedState.set(
      true,
    );
  }
}
