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
  of,
  tap,
} from 'rxjs';

import {
  ApiClientService,
} from '../api/api-client.service';

import {
  TokenStorageService,
} from '../storage/token-storage.service';

import type {
  AuthenticatedUser,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  AuthResponse,
} from './auth.models';

@Injectable({
  providedIn: 'root',
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

  private readonly currentUserState =
    signal<
      AuthenticatedUser | null
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

  restoreSession():
    void {
    const token =
      this.tokens
        .getAccessToken();

    if (!token) {
      this.currentUserState
        .set(
          null,
        );

      this.initializedState
        .set(
          true,
        );

      return;
    }

    this.api
      .get<AuthenticatedUser>(
        '/auth/me',
      )
      .pipe(
        catchError(
          () => {
            this.tokens
              .clear();

            this.currentUserState
              .set(
                null,
              );

            return of(
              null,
            );
          },
        ),
      )
      .subscribe(
        (
          user,
        ) => {
          this.currentUserState
            .set(
              user,
            );

          this.initializedState
            .set(
              true,
            );
        },
      );
  }

  register(
    request:
      RegisterRequest,
  ):
    Observable<AuthResponse> {
    return this.api
      .post<AuthResponse>(
        '/auth/register',
        request,
      )
      .pipe(
        tap(
          (
            response,
          ) => {
            this.tokens
              .setAccessToken(
                response.accessToken,
              );

            this.tokens
              .setRefreshToken(
                response.refreshToken,
              );

            this.currentUserState
              .set(
                response.user,
              );

            this.initializedState
              .set(
                true,
              );
          },
        ),
      );
  }

  login(
    request:
      LoginRequest,
  ):
    Observable<LoginResponse> {
    return this.api
      .post<LoginResponse>(
        '/auth/login',
        request,
      )
      .pipe(
        tap(
          (
            response,
          ) => {
            this.tokens
              .setAccessToken(
                response.accessToken,
              );

            if (
              response.refreshToken
            ) {
              this.tokens
                .setRefreshToken(
                  response.refreshToken,
                );
            }

            this.currentUserState
              .set(
                response.user,
              );

            this.initializedState
              .set(
                true,
              );
          },
        ),
      );
  }

  logout():
    void {
    this.tokens
      .clear();

    this.currentUserState
      .set(
        null,
      );

    this.initializedState
      .set(
        true,
      );

    void this.router
      .navigate([
        '/login',
      ]);
  }
}
