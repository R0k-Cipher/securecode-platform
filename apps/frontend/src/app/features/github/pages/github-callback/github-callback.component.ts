import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  GithubService,
} from '../../services/github.service';

@Component({
  selector:
    'app-github-callback',

  standalone:
    true,

  templateUrl:
    './github-callback.component.html',

  styleUrl:
    './github-callback.component.scss',
})
export class GithubCallbackComponent
  implements OnInit
{
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly router =
    inject(
      Router,
    );

  private readonly github =
    inject(
      GithubService,
    );

  readonly loading =
    signal(
      true,
    );

  readonly error =
    signal<string | null>(
      null,
    );

  ngOnInit():
    void {
    const installationId =
      this.route.snapshot
        .queryParamMap
        .get(
          'installation_id',
        );

    if (!installationId) {
      this.loading.set(
        false,
      );

      this.error.set(
        'Callback GitHub incomplet : installation_id manquant.',
      );

      return;
    }

    this.github
      .completeInstallation(
        installationId,
      )
      .subscribe({
        next:
          (response) => {
            const organizationId =
              response
                .context
                .organizationId;

            const projectId =
              response
                .context
                .projectId;

            const gitConnectionId =
              response
                .connection
                .id;

            this.loading.set(
              false,
            );

            void this.router.navigate(
              [
                '/organizations',
                organizationId,
                'projects',
                projectId,
                'github',
              ],
              {
                queryParams: {
                  connection:
                    gitConnectionId,
                },
              },
            );
          },

        error:
          (error) => {
            this.loading.set(
              false,
            );

            this.error.set(
              error?.error?.message ??
                'Impossible de finaliser la connexion GitHub.',
            );
          },
      });
  }
}
