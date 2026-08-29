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
  CommonModule,
} from '@angular/common';

import {
  RepositoriesService,
} from '../../services/repositories.service';

import {
  GithubService,
} from '../../../github/services/github.service';

import type {
  RepositoryListItem,
} from '../../models/repository.models';

@Component({
  selector:
    'app-repository-list',

  standalone:
    true,

  imports: [
    CommonModule,
  ],

  templateUrl:
    './repository-list.component.html',

  styleUrl:
    './repository-list.component.scss',
})
export class RepositoryListComponent
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

  private readonly repositoriesService =
    inject(
      RepositoriesService,
    );

  private readonly github =
    inject(
      GithubService,
    );

  readonly repositories =
    signal<
      RepositoryListItem[]
    >([]);

  readonly loading =
    signal(
      false,
    );

  readonly connectingGithub =
    signal(
      false,
    );

  readonly error =
    signal<
      string | null
    >(
      null,
    );

  organizationId =
    '';

  projectId =
    '';

  ngOnInit():
    void {
    this.organizationId =
      this.route.snapshot
        .paramMap
        .get(
          'organizationId',
        ) ??
      '';

    this.projectId =
      this.route.snapshot
        .paramMap
        .get(
          'projectId',
        ) ??
      '';

    this.loadRepositories();
  }

  loadRepositories():
    void {
    if (
      !this.organizationId ||
      !this.projectId
    ) {
      return;
    }

    this.loading.set(
      true,
    );

    this.error.set(
      null,
    );

    this.repositoriesService
      .list(
        this.organizationId,
        this.projectId,
      )
      .subscribe({
        next:
          (
            response,
          ) => {
            this.repositories.set(
              response.data,
            );

            this.loading.set(
              false,
            );
          },

        error:
          () => {
            this.error.set(
              'Impossible de charger les repositories.',
            );

            this.loading.set(
              false,
            );
          },
      });
  }

  connectGithub(): void {
    if (
      !this.organizationId ||
      !this.projectId
    ) {
      this.error.set(
        'Organisation ou projet introuvable.',
      );
      return;
    }

    this.connectingGithub.set(true);

    this.error.set(null);

    this.github
      .createInstallationUrl(
        this.organizationId,
        this.projectId,
      )
      .subscribe({
        next: (response) => {
          if (
            response.alreadyConnected &&
            response.connectionId
          ) {
            void this.router.navigate(
              [
                '/organizations',
                this.organizationId,
                'projects',
                this.projectId,
                'github',
              ],
              {
                queryParams: {
                  connection:
                    response.connectionId,
                },
              },
            );

            return;
          }

          if (response.installationUrl) {
            window.location.assign(
              response.installationUrl,
            );

            return;
          }
          this.connectingGithub.set(false);
          
          this.error.set(
            'Impossible de démarrer la connexion GitHub.',
          );
        },
        error:(error) => {
            this.connectingGithub.set(false);

            this.error.set(
              error?.error
                ?.message ??
              'Impossible de démarrer la connexion GitHub.',
            );
          },
      });
  }

  openRepository(
    repository:
      RepositoryListItem,
  ): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'repositories',
      repository.id,
    ]);
  }
}
