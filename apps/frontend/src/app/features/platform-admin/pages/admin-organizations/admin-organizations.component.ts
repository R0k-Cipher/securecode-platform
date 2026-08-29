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
  PlatformOrganization,
} from '../../platform-admin.models';

@Component({
  selector: 'app-admin-organizations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl:
    './admin-organizations.component.html',
  styleUrls: [
    '../../platform-admin.shared.scss',
  ],
})
export class AdminOrganizationsComponent {
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

  readonly organizations =
    signal<PlatformOrganization[]>(
      [],
    );

  readonly filtered =
    computed(
      () => {
        const term =
          this.search()
            .trim()
            .toLowerCase();

        if (!term) {
          return this.organizations();
        }

        return this.organizations()
          .filter(
            (item) =>
              `${item.name} ${item.slug} ${item.createdBy.email}`
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
      .organizations()
      .pipe(
        finalize(
          () =>
            this.loading.set(false),
        ),
      )
      .subscribe({
        next: (items) =>
          this.organizations.set(items),

        error: () =>
          this.error.set(
            'Impossible de charger les organisations.',
          ),
      });
  }
}
