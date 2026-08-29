import {
  Component,
  inject,
  signal,
} from '@angular/core';

import {
  CommonModule,
} from '@angular/common';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  Router,
  RouterLink,
} from '@angular/router';

import {
  finalize,
} from 'rxjs';

import {
  AuthService,
} from '../../../../core/auth/auth.service';

@Component({
  selector:
    'app-register',

  standalone:
    true,

  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
  ],

  templateUrl:
    './register.component.html',

  styleUrl:
    './register.component.scss',
})
export class RegisterComponent {
  private readonly fb =
    inject(
      FormBuilder,
    );

  private readonly auth =
    inject(
      AuthService,
    );

  private readonly router =
    inject(
      Router,
    );

  readonly submitting =
    signal(false);

  readonly error =
    signal<
      string |
      null
    >(null);

  readonly showPassword =
    signal(false);

  readonly form =
    this.fb.nonNullable.group({
      firstName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(100),
        ],
      ],

      lastName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(100),
        ],
      ],

      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.maxLength(320),
        ],
      ],

      organizationName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(200),
        ],
      ],

      organizationDescription: [
        '',
        [
          Validators.maxLength(1000),
        ],
      ],

      password: [
        '',
        [
          Validators.required,
          Validators.minLength(12),
          Validators.maxLength(128),
          Validators.pattern(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/,
          ),
        ],
      ],
    });

  togglePassword():
    void {
    this.showPassword.update(
      (
        value,
      ) =>
        !value,
    );
  }

  submit():
    void {
    if (
      this.form.invalid ||
      this.submitting()
    ) {
      this.form
        .markAllAsTouched();

      return;
    }

    const value =
      this.form
        .getRawValue();

    this.submitting.set(
      true,
    );

    this.error.set(
      null,
    );

    this.auth
      .register({
        firstName:
          value.firstName.trim(),

        lastName:
          value.lastName.trim(),

        email:
          value.email
            .trim()
            .toLowerCase(),

        organizationName:
          value.organizationName
            .trim(),

        organizationDescription:
          value
            .organizationDescription
            .trim() ||
          undefined,

        password:
          value.password,
      })
      .pipe(
        finalize(
          () =>
            this.submitting
              .set(false),
        ),
      )
      .subscribe({
        next:
          (
            response,
          ) => {
            const organization =
              response.organization;

            if (organization) {
              void this.router
                .navigate([
                  '/organizations',
                  organization.id,
                  'projects',
                ]);

              return;
            }

            void this.router
              .navigate([
                '/organizations',
              ]);
          },

        error:
          (
            error,
          ) => {
            const message =
              error?.error
                ?.message;

            this.error.set(
              Array.isArray(
                message,
              )
                ? message.join(
                    ' ',
                  )
                : typeof message ===
                    'string'
                  ? message
                  : 'La création de votre espace a échoué.',
            );
          },
      });
  }
}