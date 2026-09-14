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

interface InvitationRole {
  id: string;
  code: string;
  name: string;
  scope?: string;
}

interface InvitationProject {
  project: {
    id: string;
    name: string;
    slug: string;
  };

  role: InvitationRole;
}

interface InvitationPreview {
  id: string;

  email: string;

  organization: {
    id: string;
    name: string;
    slug: string;
  };

  organizationRole: InvitationRole;

  invitedBy: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };

  expiresAt: string;

  login:
    string |
    null;

  existingUser:
    boolean;

  projects:
    InvitationProject[];
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
      InvitationPreview |
      null
    >(
      null,
    );

  readonly error =
    signal<
      string |
      null
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

  readonly temporaryPassword =
    signal('');

  readonly passwordConfirmation =
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
        next:
          response => {
            this.preview.set(
              response,
            );

            /*
             * Si le backend connaît déjà
             * les noms de l'utilisateur,
             * on pourra les laisser vides.
             *
             * Sinon l'utilisateur les renseigne.
             */

            this.loading.set(
              false,
            );
          },

        error:
          error => {
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

  activate():
    void {
    const invitation =
      this.preview();

    if (
      !invitation
    ) {
      return;
    }

    const password =
      this.password();

    const confirmation =
      this.passwordConfirmation();

    const temporaryPassword =
      this.temporaryPassword();

    if (temporaryPassword.length < 12) {
      this.error.set(
        'Saisissez le mot de passe temporaire reçu par email.',
      );

      return;
    }

    if (
      password.length <
      12
    ) {
      this.error.set(
        'Le mot de passe doit contenir au moins 12 caractères.',
      );

      return;
    }

    if (
      password !==
      confirmation
    ) {
      this.error.set(
        'Les mots de passe ne correspondent pas.',
      );

      return;
    }

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
          
          temporaryPassword,

          firstName:
            this.firstName()
              .trim(),

          lastName:
            this.lastName()
              .trim(),

          password,
        },
      )
      .subscribe({
        next:
          () => {
            this.submitting.set(
              false,
            );

            void this.router
              .navigate(
                [
                  '/login',
                ],
                {
                  queryParams: {
                    activated:
                      '1',

                    login:
                      invitation.login ??
                      '',
                  },
                },
              );
          },

        error:
          error => {
            this.submitting.set(
              false,
            );

            this.error.set(
              error?.error?.message ??
              "Impossible d'activer le compte.",
            );
          },
      });
  }
}
