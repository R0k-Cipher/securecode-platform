import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import {
  CommonModule,
} from '@angular/common';

import {
  FormsModule,
} from '@angular/forms';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  Subject,
  finalize,
  takeUntil,
} from 'rxjs';

import {
  GithubService,
} from '../../services/github.service';

import type {
  GithubRepository,
  GithubRepositoryPage,
} from '../../models/github.models';

@Component({
  selector:
    'app-github-repositories',

  standalone:
    true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl:
    './github-repositories.component.html',

  styleUrl:
    './github-repositories.component.scss',
})
export class GithubRepositoriesComponent
  implements
    OnInit,
    OnDestroy
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

  readonly installation =
    signal<
      GithubRepositoryPage['installation'] | null
    >(null);

  private readonly destroy$ =
    new Subject<void>();

  readonly repositories =
    signal<
      GithubRepository[]
    >([]);

  readonly loading =
    signal(false);

  readonly error =
    signal<
      string | null
    >(null);

  readonly importingRepositoryId =
    signal<
      number | null
    >(null);

  organizationId =
    '';

  projectId =
    '';

  gitConnectionId =
    '';

  search =
    '';

  page =
    1;

  totalPages =
    1;

  ngOnInit():
    void
  {
    this.organizationId =
      this.route.snapshot
        .paramMap
        .get(
          'organizationId',
        ) ?? '';

    this.projectId =
      this.route.snapshot
        .paramMap
        .get(
          'projectId',
        ) ?? '';

    this.gitConnectionId =
      this.route.snapshot
        .queryParamMap
        .get(
          'connection',
        ) ?? '';

    if (
      !this.organizationId ||
      !this.projectId
    ) {
      this.error.set(
        'Organisation ou projet introuvable.',
      );

      return;
    }

    if (
      !this.gitConnectionId
    ) {
      this.error.set(
        'Aucune connexion GitHub sélectionnée.',
      );

      return;
    }

    this.loadRepositories();
  }

  ngOnDestroy():
    void
  {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRepositories():
    void
  {
    if (
      !this.organizationId ||
      !this.gitConnectionId
    ) {
      return;
    }

    this.loading.set(
      true,
    );

    this.error.set(
      null,
    );

    this.github
      .listRepositories(
        this.organizationId,
        this.gitConnectionId,
        this.page,
        25,
        this.search.trim() ||
          undefined,
      )
      .pipe(
        takeUntil(
          this.destroy$,
        ),

        finalize(
          () => {
            this.loading.set(
              false,
            );
          },
        ),
      )
      .subscribe({
        next:
          (
            response,
          ) => {
            this.repositories.set(
              response.items,
            );

            this.installation.set(
              response.installation ??
              null,
            );

            this.totalPages =
              Math.max(
                1,
                response.pagination
                  .totalPages,
              );

            if (
              this.page >
              this.totalPages
            ) {
              this.page =
                this.totalPages;
            }
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              error?.error
                ?.message ??
              'Impossible de récupérer les repositories GitHub.',
            );
          },
      });
  }

  searchRepositories():
    void
  {
    this.page =
      1;

    this.loadRepositories();
  }

  previousPage():
    void
  {
    if (
      this.page <= 1 ||
      this.loading()
    ) {
      return;
    }

    this.page -=
      1;

    this.loadRepositories();
  }

  nextPage():
    void
  {
    if (
      this.page >=
        this.totalPages ||
      this.loading()
    ) {
      return;
    }

    this.page +=
      1;

    this.loadRepositories();
  }

  manageGithubInstallation():
    void
  {
    const url =
      this.installation()
        ?.manageUrl;

    if (!url) {
      this.error.set(
        "Impossible d'ouvrir la gestion de l'installation GitHub.",
      );

      return;
    }

    window.open(
      url,
      '_blank',
      'noopener,noreferrer',
    );
  }

  importRepository(
    repository:
      GithubRepository,
  ):
    void
  {
    if (
      repository.imported
    ) {
      this.error.set(
        repository.projectId ===
        this.projectId
          ? 'Ce repository est déjà importé dans ce projet.'
          : 'Ce repository est déjà associé à un autre projet de cette organisation.',
      );

      return;
    }
    if (
      this.importingRepositoryId() !==
      null
    ) {
      return;
    }

    this.importingRepositoryId
      .set(
        repository.id,
      );

    this.error.set(
      null,
    );

    this.github
      .importRepository(
        this.organizationId,
        this.projectId,
        this.gitConnectionId,
        repository.id,
        true,
      )
      .pipe(
        takeUntil(
          this.destroy$,
        ),

        finalize(
          () => {
            this.importingRepositoryId
              .set(
                null,
              );
          },
        ),
      )
      .subscribe({
        next:
          (
            result,
          ) => {
            void this.router.navigate([
              '/organizations',
              this.organizationId,
              'projects',
              this.projectId,
              'repositories',
              result.repositoryId,
            ]);
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              error?.error
                ?.message ??
              `Impossible d'importer ${repository.fullName}.`,
            );
          },
      });
  }
}
