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
} from '@angular/router';

import {
  finalize,
} from 'rxjs';

import {
  AuthService,
} from '../../../../core/auth/auth.service';

@Component({
  selector:
    'app-login',

  standalone:
    true,

  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],

  templateUrl:
    './login.component.html',

  styleUrl:
    './login.component.scss',
})
export class LoginComponent {
  private readonly fb =
    inject(FormBuilder);

  private readonly auth =
    inject(AuthService);

  private readonly router =
    inject(Router);

  readonly loading =
    signal(false);

  readonly error =
    signal<string | null>(
      null,
    );

  readonly showPassword =
    signal(false);

  readonly form =
    this.fb.nonNullable.group({
      email: [
        '',
        [
          Validators.required,
          Validators.email,
        ],
      ],

      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
        ],
      ],
    });

  togglePassword():
    void {
    this.showPassword.update(
      (value) =>
        !value,
    );
  }

  submit():
    void {
    if (
      this.form.invalid ||
      this.loading()
    ) {
      this.form.markAllAsTouched();

      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.auth
      .login(
        this.form.getRawValue(),
      )
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
          () => {
            void this.router.navigate([
              '/organizations',
            ]);
          },

        error:
          (
            error,
          ) => {
            const message =
              error?.error?.message;

            this.error.set(
              typeof message ===
                'string'
                ? message
                : 'Impossible de vous connecter avec ces identifiants.',
            );
          },
      });
  }
}
