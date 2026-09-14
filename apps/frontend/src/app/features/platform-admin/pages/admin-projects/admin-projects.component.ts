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
  PlatformProject,
} from '../../platform-admin.models';

@Component({
  selector: 'app-admin-projects',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl:
    './admin-projects.component.html',
  styleUrls: [
    '../../platform-admin.shared.scss',
  ],
})
export class AdminProjectsComponent {
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

  readonly projects =
    signal<PlatformProject[]>(
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
          return this.projects();
        }

        return this.projects()
          .filter(
            (item) =>
              `${item.name} ${item.slug} ${item.status} ${item.organization.name}`
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

    this.admin
      .projects()
      .pipe(
        finalize(
          () =>
            this.loading.set(false),
        ),
      )
      .subscribe({
        next: (items) =>
          this.projects.set(items),

        error: () =>
          this.error.set(
            'Impossible de charger les projets.',
          ),
      });
  }
}
