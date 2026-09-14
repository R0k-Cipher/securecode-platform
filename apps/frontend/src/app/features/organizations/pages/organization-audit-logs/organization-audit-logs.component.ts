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
  ActivatedRoute,
} from '@angular/router';

import {
  OrganizationAuditService,
  type OrganizationAuditLog,
} from '../../services/organization-audit.service';

import {
  AuthContextService,
} from '../../../../core/auth/auth-context.service';

import {
  PERMISSIONS,
} from '../../../../core/auth/auth-context.models';

@Component({
  selector:
    'app-organization-audit-logs',

  standalone:
    true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl:
    './organization-audit-logs.component.html',

  styleUrl:
    './organization-audit-logs.component.scss',
})
export class OrganizationAuditLogsComponent {
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly audit =
    inject(
      OrganizationAuditService,
    );

  private readonly authContext =
    inject(
      AuthContextService,
    );

  readonly canReadAudit =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS.AUDIT_LOG_READ,
          ),
    );

  readonly organizationId =
    this.route.snapshot
      .paramMap
      .get(
        'organizationId',
      )!;

  readonly loading =
    signal(
      true,
    );

  readonly search =
    signal(
      '',
    );

  readonly logs =
    signal<
      OrganizationAuditLog[]
    >(
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
            (
              log,
            ) =>
              `${log.action} ${log.resourceType} ${log.resourceId ?? ''} ${log.actor?.email ?? ''} ${log.description ?? ''} ${log.ipAddress ?? ''}`
                .toLowerCase()
                .includes(
                  term,
                ),
          );
      },
    );

  constructor() {
    this.load();
  }

  load():
    void {
      
    if (
      !this.canReadAudit()
    ) {
      this.loading.set(
        false,
      );

      return;
    }

    this.loading.set(
      true,
    );

    this.audit
      .list(
        this.organizationId,
      )
      .subscribe({
        next: (
          response,
        ) => {
          this.logs.set(
            response.data,
          );

          this.loading.set(
            false,
          );
        },

        error: () => {
          this.loading.set(
            false,
          );
        },
      });
  }
}
