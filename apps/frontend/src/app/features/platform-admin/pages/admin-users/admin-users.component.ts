import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  FormsModule,
} from '@angular/forms';

import {
  finalize,
} from 'rxjs';

import {
  PlatformAdminService,
} from '../../platform-admin.service';

import type {
  PlatformRole,
  PlatformUser,
  PlatformUserStatus,
} from '../../platform-admin.models';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl:
    './admin-users.component.html',
  styleUrls: [
    '../../platform-admin.shared.scss',
  ],
})
export class AdminUsersComponent {
  private readonly admin =
    inject(
      PlatformAdminService,
    );

  readonly loading =
    signal(true);

  readonly error =
    signal<string | null>(
      null,
    );

  readonly search =
    signal('');

  readonly users =
    signal<PlatformUser[]>(
      [],
    );

  readonly filteredUsers =
    computed(
      () => {
        const term =
          this.search()
            .trim()
            .toLowerCase();

        if (!term) {
          return this.users();
        }

        return this.users()
          .filter(
            (user) =>
              `${user.firstName} ${user.lastName} ${user.email} ${user.status} ${user.platformRole}`
                .toLowerCase()
                .includes(term),
          );
      },
    );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.admin
      .users()
      .pipe(
        finalize(
          () =>
            this.loading.set(false),
        ),
      )
      .subscribe({
        next: (users) =>
          this.users.set(users),

        error: () =>
          this.error.set(
            'Impossible de charger les utilisateurs.',
          ),
      });
  }

  changeStatus(
    user: PlatformUser,
    status: PlatformUserStatus,
  ): void {
    if (
      user.status === status
    ) {
      return;
    }

    this.admin
      .setStatus(
        user.id,
        status,
      )
      .subscribe({
        next: () => {
          this.users.update(
            (items) =>
              items.map(
                (item) =>
                  item.id === user.id
                    ? {
                        ...item,
                        status,
                      }
                    : item,
              ),
          );
        },
      });
  }

  changeRole(
    user: PlatformUser,
    platformRole: PlatformRole,
  ): void {
    if (
      user.platformRole ===
      platformRole
    ) {
      return;
    }

    this.admin
      .setRole(
        user.id,
        platformRole,
      )
      .subscribe({
        next: () => {
          this.users.update(
            (items) =>
              items.map(
                (item) =>
                  item.id === user.id
                    ? {
                        ...item,
                        platformRole,
                      }
                    : item,
              ),
          );
        },
      });
  }
}
