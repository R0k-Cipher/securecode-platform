import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  inject,
  signal,
} from '@angular/core';

import {
  finalize,
} from 'rxjs';

import {
  PlatformAdminService,
} from '../../platform-admin.service';

import type {
  PlatformSystemStatus,
} from '../../platform-admin.models';

@Component({
  selector: 'app-admin-system',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl:
    './admin-system.component.html',
  styleUrls: [
    '../../platform-admin.shared.scss',
  ],
})
export class AdminSystemComponent {
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

  readonly status =
    signal<
      PlatformSystemStatus | null
    >(
      null,
    );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.admin
      .systemStatus()
      .pipe(
        finalize(
          () =>
            this.loading.set(false),
        ),
      )
      .subscribe({
        next: (status) =>
          this.status.set(status),

        error: () =>
          this.error.set(
            'Impossible de lire l’état du système.',
          ),
      });
  }
}
