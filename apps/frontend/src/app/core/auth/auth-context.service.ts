import {
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  Observable,
  catchError,
  finalize,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';

import {
  ApiClientService,
} from '../api/api-client.service';

import type {
  AuthContext,
  AuthContextProject,
  PermissionCode,
} from './auth-context.models';

@Injectable({
  providedIn:
    'root',
})
export class AuthContextService {
  private readonly api =
    inject(
      ApiClientService,
    );

  private readonly contextState =
    signal<
      AuthContext |
      null
    >(
      null,
    );

  private readonly loadedState =
    signal(
      false,
    );

  private readonly loadingState =
    signal(
      false,
    );

  private loadRequest:
    Observable<AuthContext> |
    null =
    null;

  readonly context =
    this.contextState
      .asReadonly();

  readonly loaded =
    this.loadedState
      .asReadonly();

  readonly loading =
    this.loadingState
      .asReadonly();

  readonly organization =
    computed(
      () =>
        this.contextState()
          ?.organization ??
        null,
    );

  readonly organizationRole =
    computed(
      () =>
        this.contextState()
          ?.organizationRole ??
        null,
    );

  readonly projects =
    computed(
      () =>
        this.contextState()
          ?.projects ??
        [],
    );

  readonly isPlatformAdmin =
    computed(
      () =>
        this.contextState()
          ?.platformRole ===
        'PLATFORM_ADMIN',
    );

  readonly isCustomerContext =
    computed(
      () =>
        !this.isPlatformAdmin() &&
        this.contextState()
          ?.contextType ===
        'ORGANIZATION' &&
        Boolean(
          this.organization(),
        ),
    );

  readonly isOwner =
    computed(
      () =>
        !this.isPlatformAdmin() &&
        this.contextState()
          ?.organizationRole
          ?.code ===
        'OWNER',
    );

  load(
    force =
      false,
  ): Observable<AuthContext> {
    if (
      !force &&
      this.loadedState() &&
      this.contextState()
    ) {
      return of(
        this.contextState()!,
      );
    }

    if (
      !force &&
      this.loadRequest
    ) {
      return this.loadRequest;
    }

    this.loadingState.set(
      true,
    );

    this.loadRequest =
      this.api
        .get<AuthContext>(
          '/auth/me/context',
        )
        .pipe(
          tap(
            context => {
              this.contextState.set(
                context,
              );

              this.loadedState.set(
                true,
              );
            },
          ),

          catchError(
            error => {
              this.contextState.set(
                null,
              );

              this.loadedState.set(
                false,
              );

              return throwError(
                () =>
                  error,
              );
            },
          ),

          finalize(
            () => {
              this.loadingState.set(
                false,
              );

              this.loadRequest =
                null;
            },
          ),

          shareReplay({
            bufferSize:
              1,

            refCount:
              false,
          }),
        );

    return this.loadRequest;
  }

  refresh():
    Observable<AuthContext> {
    return this.load(
      true,
    );
  }

  clear():
    void {
    this.contextState.set(
      null,
    );

    this.loadedState.set(
      false,
    );

    this.loadingState.set(
      false,
    );

    this.loadRequest =
      null;
  }

  hasOrganization(
    organizationId:
      string,
  ): boolean {
    if (
      this.isPlatformAdmin()
    ) {
      return false;
    }

    return (
      this.contextState()
        ?.organization
        ?.id ===
      organizationId
    );
  }

  hasProject(
    projectId:
      string,
  ): boolean {
    if (
      this.isPlatformAdmin()
    ) {
      return false;
    }

    return Boolean(
      this.getProject(
        projectId,
      ),
    );
  }

  getProject(
    projectId:
      string,
  ):
    AuthContextProject |
    null {
    if (
      this.isPlatformAdmin()
    ) {
      return null;
    }

    return (
      this.contextState()
        ?.projects
        .find(
          project =>
            project.id ===
            projectId,
        ) ??
      null
    );
  }

  projectRole(
    projectId:
      string,
  ):
    string |
    null {
    return (
      this.getProject(
        projectId,
      )
        ?.role.code ??
      null
    );
  }

  canOrganization(
    permission:
      PermissionCode |
      string,
  ): boolean {
    if (
      this.isPlatformAdmin()
    ) {
      return false;
    }

    return (
      this.contextState()
        ?.organizationPermissions
        .includes(
          permission,
        ) ??
      false
    );
  }

  canProject(
    projectId:
      string,
    permission:
      PermissionCode |
      string,
  ): boolean {
    if (
      this.isPlatformAdmin()
    ) {
      return false;
    }

    const project =
      this.getProject(
        projectId,
      );

    if (!project) {
      return false;
    }

    if (
      project.ownerOverride
    ) {
      return true;
    }

    return project.permissions
      .includes(
        permission,
      );
  }
}
