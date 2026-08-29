import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  inject,
  signal,
} from '@angular/core';

import {
  FormsModule,
} from '@angular/forms';

import {
  ActivatedRoute,
  Router,
  RouterLink,
} from '@angular/router';

import {
  ApiClientService,
} from '../../../core/api/api-client.service';

import {
  AuthService,
} from '../../../core/auth/auth.service';

interface InvitationPreview {
  email: string;

  organization: {
    id: string;
    name: string;
    slug: string;
  };

  role: {
    id: string;
    code: string;
    name: string;
  };

  invitedBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };

  expiresAt: string;

  existingUser: boolean;
}

@Component({
  selector:
    'app-invitation-page',

  standalone:
    true,

  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
  ],

  templateUrl:
    './invitation-page.component.html',

  styleUrl:
    './invitation-page.component.scss',
})
export class InvitationPageComponent {
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly router =
    inject(
      Router,
    );

  private readonly api =
    inject(
      ApiClientService,
    );

  readonly auth =
    inject(
      AuthService,
    );

  readonly token =
    this.route.snapshot
      .queryParamMap
      .get(
        'token',
      ) ??
    '';

  readonly loading =
    signal(
      true,
    );

  readonly preview =
    signal<
      InvitationPreview | null
    >(
      null,
    );

  readonly error =
    signal<
      string | null
    >(
      null,
    );

  readonly firstName =
    signal(
      '',
    );

  readonly lastName =
    signal(
      '',
    );

  readonly password =
    signal(
      '',
    );

  readonly submitting =
    signal(
      false,
    );

  constructor() {
    this.load();
  }

  load():
    void {
    if (
      !this.token
    ) {
      this.loading.set(
        false,
      );

      this.error.set(
        'Lien d’invitation incomplet.',
      );

      return;
    }

    this.api
      .get<
        InvitationPreview
      >(
        `/invitations/${encodeURIComponent(
          this.token,
        )}`,
      )
      .subscribe({
        next: (
          response,
        ) => {
          this.preview.set(
            response,
          );

          this.loading.set(
            false,
          );
        },

        error: (
          error,
        ) => {
          this.loading.set(
            false,
          );

          this.error.set(
            error?.error?.message ??
            'Invitation invalide ou expirée.',
          );
        },
      });
  }

  acceptExisting():
    void {
    this.submitting.set(
      true,
    );

    this.error.set(
      null,
    );

    this.api
      .post(
        '/organizations/invitations/accept',
        {
          token:
            this.token,
        },
      )
      .subscribe({
        next: () => {
          this.submitting.set(
            false,
          );

          const organizationId =
            this.preview()
              ?.organization
              .id;

          void this.router
            .navigate([
              organizationId
                ? `/organizations/${organizationId}/projects`
                : '/organizations',
            ]);
        },

        error: (
          error,
        ) => {
          this.submitting.set(
            false,
          );

          this.error.set(
            error?.error?.message ??
            'Impossible d’accepter l’invitation.',
          );
        },
      });
  }

  register():
    void {
    this.submitting.set(
      true,
    );

    this.error.set(
      null,
    );

    this.api
      .post(
        `/invitations/${encodeURIComponent(
          this.token,
        )}/register`,
        {
          firstName:
            this.firstName(),

          lastName:
            this.lastName(),

          password:
            this.password(),
        },
      )
      .subscribe({
        next: () => {
          this.submitting.set(
            false,
          );

          void this.router
            .navigate([
              '/login',
            ]);
        },

        error: (
          error,
        ) => {
          this.submitting.set(
            false,
          );

          this.error.set(
            error?.error?.message ??
            'Impossible de créer le compte.',
          );
        },
      });
  }
}
