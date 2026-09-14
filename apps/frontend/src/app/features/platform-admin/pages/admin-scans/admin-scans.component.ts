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
  PlatformScan,
} from '../../platform-admin.models';

@Component({
  selector: 'app-admin-scans',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl:
    './admin-scans.component.html',
  styleUrls: [
    '../../platform-admin.shared.scss',
  ],
})
export class AdminScansComponent {
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

  readonly scans =
    signal<PlatformScan[]>(
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
          return this.scans();
        }

        return this.scans()
          .filter(
            (item) =>
              `${item.status} ${item.trigger} ${item.type} ${item.project.name} ${item.repository.fullName} ${item.commitSha}`
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
      .scans()
      .pipe(
        finalize(
          () =>
            this.loading.set(false),
        ),
      )
      .subscribe({
        next: (items) =>
          this.scans.set(items),

        error: () =>
          this.error.set(
            'Impossible de charger les scans.',
          ),
      });
  }

  statusClass(
    status: string,
  ): string {
    if (
      status === 'COMPLETED'
    ) {
      return 'success';
    }

    if (
      status === 'FAILED' ||
      status === 'CANCELLED'
    ) {
      return 'danger';
    }

    if (
      status === 'QUEUED'
    ) {
      return 'warning';
    }

    return 'info';
  }
}
