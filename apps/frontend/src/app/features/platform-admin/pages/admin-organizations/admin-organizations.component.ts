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
  CreatePlatformOrganizationPayload,
  PlatformOrganization,
} from '../../platform-admin.models';

@Component({
  selector:
    'app-admin-organizations',

  standalone:
    true,

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

  readonly creating =
    signal(false);

  readonly error =
    signal<string | null>(
      null,
    );

  readonly createError =
    signal<string | null>(
      null,
    );

  readonly createSuccess =
    signal<string | null>(
      null,
    );

  readonly search =
    signal('');

  readonly showCreateForm =
    signal(false);

  readonly organizations =
    signal<
      PlatformOrganization[]
    >([]);

  /*
  |--------------------------------------------------------------------------
  | Form
  |--------------------------------------------------------------------------
  */

  organizationName =
    '';

  organizationSlug =
    '';

  organizationDescription =
    '';

  organizationLogoUrl =
    '';

  ownerFirstName =
    '';

  ownerLastName =
    '';

  ownerEmail =
    '';

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

        return this
          .organizations()
          .filter(
            (item) =>
              `${item.name} ${item.slug} ${item.createdBy.email}`
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

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  load(): void {
    this.loading.set(
      true,
    );

    this.error.set(
      null,
    );

    this.admin
      .organizations()
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
          (items) =>
            this.organizations.set(
              items,
            ),

        error:
          () =>
            this.error.set(
              'Impossible de charger les organisations.',
            ),
      });
  }

  /*
  |--------------------------------------------------------------------------
  | Create
  |--------------------------------------------------------------------------
  */

  createOrganization():
    void {
    this.createError.set(
      null,
    );

    this.createSuccess.set(
      null,
    );

    const name =
      this.organizationName
        .trim();

    const ownerEmail =
      this.ownerEmail
        .trim()
        .toLowerCase();

    const ownerFirstName =
      this.ownerFirstName
        .trim();

    const ownerLastName =
      this.ownerLastName
        .trim();

    if (
      !name ||
      !ownerEmail ||
      !ownerFirstName ||
      !ownerLastName
    ) {
      this.createError.set(
        'Le nom de l’organisation et les informations du propriétaire sont obligatoires.',
      );

      return;
    }

    const payload:
      CreatePlatformOrganizationPayload = {
        name,

        ownerEmail,

        ownerFirstName,

        ownerLastName,
      };

    const slug =
      this.organizationSlug
        .trim();

    const description =
      this.organizationDescription
        .trim();

    const logoUrl =
      this.organizationLogoUrl
        .trim();

    if (slug) {
      payload.slug =
        slug;
    }

    if (description) {
      payload.description =
        description;
    }

    if (logoUrl) {
      payload.logoUrl =
        logoUrl;
    }

    this.creating.set(
      true,
    );

    this.admin
      .createOrganization(
        payload,
      )
      .pipe(
        finalize(
          () =>
            this.creating.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          () => {
            this.createSuccess.set(
              'Organisation créée avec succès.',
            );

            this.resetForm();

            this.showCreateForm.set(
              false,
            );

            this.load();
          },

        error:
          (error) => {
            const message =
              error?.error
                ?.message;

            this.createError.set(
              Array.isArray(
                message,
              )
                ? message.join(
                    ', ',
                  )
                : message ||
                    'Impossible de créer l’organisation.',
            );
          },
      });
  }

  /*
  |--------------------------------------------------------------------------
  | Form helpers
  |--------------------------------------------------------------------------
  */

  openCreateForm():
    void {
    this.createError.set(
      null,
    );

    this.createSuccess.set(
      null,
    );

    this.showCreateForm.set(
      true,
    );
  }

  closeCreateForm():
    void {
    if (
      this.creating()
    ) {
      return;
    }

    this.showCreateForm.set(
      false,
    );

    this.createError.set(
      null,
    );
  }

  private resetForm():
    void {
    this.organizationName =
      '';

    this.organizationSlug =
      '';

    this.organizationDescription =
      '';

    this.organizationLogoUrl =
      '';

    this.ownerFirstName =
      '';

    this.ownerLastName =
      '';

    this.ownerEmail =
      '';
  }
}
