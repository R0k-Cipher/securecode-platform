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
  selector:
    'app-admin-audit-logs',

  standalone:
    true,

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
    signal(
      true,
    );

  readonly error =
    signal<
      string |
      null
    >(
      null,
    );

  readonly search =
    signal(
      '',
    );

  readonly logs =
    signal<
      PlatformAuditLog[]
    >(
      [],
    );

  readonly filtered =
    computed(
      () => {
        const items =
          this.logs();

        if (
          !Array.isArray(
            items,
          )
        ) {
          return [];
        }

        const term =
          this.search()
            .trim()
            .toLowerCase();

        if (!term) {
          return items;
        }

        return items.filter(
          item => {
            const searchable =
              [
                item.action,

                item.resourceType,

                item.resourceId ??
                  '',

                item.description ??
                  '',

                item.actor
                  ?.email ??
                  '',

                item.actor
                  ?.firstName ??
                  '',

                item.actor
                  ?.lastName ??
                  '',

                item.organization
                  ?.name ??
                  '',

                item.organization
                  ?.slug ??
                  '',

                item.project
                  ?.name ??
                  '',

                item.project
                  ?.slug ??
                  '',

                item.ipAddress ??
                  '',
              ]
                .join(
                  ' ',
                )
                .toLowerCase();

            return searchable
              .includes(
                term,
              );
          },
        );
      },
    );

  constructor() {
    this.load();
  }

  load():
    void {
    this.loading.set(
      true,
    );

    this.error.set(
      null,
    );

    this.admin
      .auditLogs()
      .pipe(
        finalize(
          () =>
            this.loading.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          items => {
            if (
              !Array.isArray(
                items,
              )
            ) {
              this.logs.set(
                [],
              );

              this.error.set(
                'Format de réponse invalide pour les journaux d’audit.',
              );

              return;
            }

            this.logs.set(
              items,
            );
          },

        error:
          error => {
            this.logs.set(
              [],
            );

            const message =
              error?.error
                ?.message;

            this.error.set(
              typeof message ===
                'string'
                ? message
                : 'Impossible de charger les journaux d’audit.',
            );
          },
      });
  }
}