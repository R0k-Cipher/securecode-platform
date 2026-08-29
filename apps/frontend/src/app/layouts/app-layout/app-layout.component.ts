import {
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  CommonModule,
} from '@angular/common';

import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';

import {
  filter,
} from 'rxjs';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
  AuthService,
} from '../../core/auth/auth.service';

import {
  WorkspaceContextService,
} from '../../core/context/workspace-context.service';

import { NotificationBellComponent } from '../../features/notifications/notification-bell/notification-bell.component';


@Component({
  selector: 'app-layout',

  standalone: true,

  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NotificationBellComponent,
  ],

  templateUrl:
    './app-layout.component.html',

  styleUrl:
    './app-layout.component.scss',
})
export class AppLayoutComponent {
  private readonly auth =
    inject(AuthService);

  private readonly workspace =
    inject(WorkspaceContextService);

  private readonly router =
    inject(Router);

  private readonly destroyRef =
    inject(DestroyRef);

  readonly mobileMenuOpen =
    signal(false);

  readonly currentUrl =
    signal(
      this.router.url,
    );

  readonly user =
    this.auth.currentUser;

  readonly organization =
    this.workspace.organization;

  readonly project =
    this.workspace.project;

  readonly isPlatformAdmin =
    computed(
      () =>
        this.user()
          ?.platformRole ===
        'PLATFORM_ADMIN',
    );

  readonly isPlatformArea =
    computed(
      () =>
        this.currentUrl()
          .startsWith(
            '/platform-admin',
          ),
    );

  readonly hasOrganization =
    computed(
      () =>
        Boolean(
          this.organization()
            ?.id,
        ),
    );

  readonly hasProject =
    computed(
      () =>
        Boolean(
          this.project()
            ?.id,
        ),
    );

  readonly projectBase =
    computed(
      () => {
        const organizationId =
          this.organization()
            ?.id;

        const projectId =
          this.project()
            ?.id;

        if (
          !organizationId ||
          !projectId
        ) {
          return null;
        }

        return (
          `/organizations/${organizationId}` +
          `/projects/${projectId}`
        );
      },
    );

  readonly projectsUrl =
    computed(
      () => {
        const organizationId =
          this.organization()
            ?.id;

        return organizationId
          ? `/organizations/${organizationId}/projects`
          : '/organizations';
      },
    );

  readonly membersUrl =
    computed(
      () => {
        const organizationId =
          this.organization()
            ?.id;

        return organizationId
          ? `/organizations/${organizationId}/members`
          : '/organizations';
      },
    );

  readonly displayName =
    computed(
      () => {
        const user =
          this.user();

        if (!user) {
          return 'Utilisateur';
        }

        const fullName =
          [
            user.firstName,
            user.lastName,
          ]
            .filter(Boolean)
            .join(' ')
            .trim();

        return (
          fullName ||
          user.email
        );
      },
    );

  constructor() {
    this.router.events
      .pipe(
        filter(
          (
            event,
          ): event is NavigationEnd =>
            event instanceof
            NavigationEnd,
        ),

        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(
        (
          event,
        ) => {
          this.currentUrl.set(
            event.urlAfterRedirects,
          );

          this.mobileMenuOpen
            .set(false);
        },
      );
  }

  toggleMobileMenu():
    void {
    this.mobileMenuOpen
      .update(
        (open) =>
          !open,
      );
  }

  closeMobileMenu():
    void {
    this.mobileMenuOpen
      .set(false);
  }

  goToPlatformAdmin():
    void {
    if (
      !this.isPlatformAdmin()
    ) {
      return;
    }

    void this.router.navigate([
      '/platform-admin',
    ]);
  }

  goToWorkspace():
    void {
    void this.router.navigate([
      '/organizations',
    ]);
  }

  logout():
    void {
    this.workspace.clear();

    this.auth.logout();

    void this.router.navigate([
      '/login',
    ]);
  }

  initials():
    string {
    const user =
      this.user();

    if (!user) {
      return 'SC';
    }

    return (
      `${user.firstName?.[0] ?? ''}` +
      `${user.lastName?.[0] ?? ''}`
    )
      .toUpperCase() ||
      'SC';
  }
}
