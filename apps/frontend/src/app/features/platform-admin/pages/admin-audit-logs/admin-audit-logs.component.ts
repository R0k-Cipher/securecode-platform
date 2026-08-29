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
  PlatformAuditLog,
} from '../../platform-admin.models';

@Component({
  selector: 'app-admin-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
  ],
  templateUrl:
    './admin-audit-logs.component.html',
  styleUrls: [
    '../../platform-admin.shared.scss',
  ],
})
export class AdminAuditLogsComponent {
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

  readonly logs =
    signal<PlatformAuditLog[]>(
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
          return this.logs();
        }

        return this.logs()
          .filter(
            (item) =>
              `${item.action} ${item.resourceType} ${item.resourceId ?? ''} ${item.description ?? ''} ${item.actor?.email ?? ''} ${item.organization?.name ?? ''} ${item.project?.name ?? ''}`
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
      .auditLogs()
      .pipe(
        finalize(
          () =>
            this.loading.set(false),
        ),
      )
      .subscribe({
        next: (items) =>
          this.logs.set(items),

        error: () =>
          this.error.set(
            'Impossible de charger les journaux d’audit.',
          ),
      });
  }
}
