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
  Router,
} from '@angular/router';

import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  finalize,
  takeUntil,
} from 'rxjs';

import {
  WorkspaceContextService,
} from '../../../../core/context/workspace-context.service';

import {
  OrganizationsService,
} from '../../services/organizations.service';

import type {
  Organization,
  OrganizationPagination,
} from '../../models/organization.models';

@Component({
  selector:
    'app-organization-list',

  standalone:
    true,

  imports: [
    CommonModule,
  ],

  templateUrl:
    './organization-list.component.html',

  styleUrl:
    './organization-list.component.scss',
})
export class OrganizationListComponent
  implements
    OnInit,
    OnDestroy
{
  private readonly organizationsService =
    inject(
      OrganizationsService,
    );

  private readonly workspace =
    inject(
      WorkspaceContextService,
    );

  private readonly router =
    inject(
      Router,
    );

  private readonly destroy$ =
    new Subject<void>();

  private readonly searchSubject =
    new Subject<string>();

  readonly organizations =
    signal<
      Organization[]
    >([]);

  readonly pagination =
    signal<
      OrganizationPagination
    >({
      page:
        1,

      limit:
        20,

      total:
        0,

      totalPages:
        0,

      hasNextPage:
        false,

      hasPreviousPage:
        false,
    });

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

  ngOnInit():
    void {
    this.searchSubject
      .pipe(
        debounceTime(
          350,
        ),

        distinctUntilChanged(),

        takeUntil(
          this.destroy$,
        ),
      )
      .subscribe(
        (
          search,
        ) => {
          this.load(
            1,
            search,
          );
        },
      );

    this.load();
  }

  ngOnDestroy():
    void {
    this.destroy$
      .next();

    this.destroy$
      .complete();

    this.searchSubject
      .complete();
  }

  load(
    page =
      1,

    search =
      this.search(),
  ): void {
    this.loading.set(
      true,
    );

    this.error.set(
      null,
    );

    this.organizationsService
      .listMine({
        page,

        limit:
          20,

        search:
          search.trim() ||
          undefined,
      })
      .pipe(
        takeUntil(
          this.destroy$,
        ),

        finalize(
          () =>
            this.loading
              .set(
                false,
              ),
        ),
      )
      .subscribe({
        next:
          (
            response,
          ) => {
            this.organizations
              .set(
                response.data,
              );

            this.pagination
              .set(
                response.meta,
              );
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              this.readError(
                error,
                'Impossible de charger les organisations.',
              ),
            );
          },
      });
  }

  onSearch(
    value:
      string,
  ): void {
    this.search.set(
      value,
    );

    this.searchSubject
      .next(
        value,
      );
  }

  previousPage():
    void {
    const current =
      this.pagination();

    if (
      !current
        .hasPreviousPage
    ) {
      return;
    }

    this.load(
      current.page -
        1,
    );
  }

  nextPage():
    void {
    const current =
      this.pagination();

    if (
      !current
        .hasNextPage
    ) {
      return;
    }

    this.load(
      current.page +
        1,
    );
  }

  open(
    organization: Organization,
  ): void {
    this.workspace.setOrganization({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      roleCode:
        organization.currentUserRole?.code ??
        null,
    });

    void this.router.navigate([
      '/organizations',
      organization.id,
      'projects',
    ]);
  }

  roleLabel(
    organization:
      Organization,
  ): string {
    return (
      organization
        .currentUserRole
        ?.name ??
      organization
        .currentUserRole
        ?.code ??
      'Membre'
    );
  }

  initials(
    organization:
      Organization,
  ): string {
    return organization
      .name
      .split(/\s+/)
      .filter(
        Boolean,
      )
      .slice(
        0,
        2,
      )
      .map(
        (
          word,
        ) =>
          word[0],
      )
      .join('')
      .toUpperCase();
  }

  private readError(
    error:
      any,

    fallback:
      string,
  ): string {
    const message =
      error?.error
        ?.message;

    if (
      Array.isArray(
        message,
      )
    ) {
      return message.join(
        ' ',
      );
    }

    return typeof message ===
      'string'
        ? message
        : fallback;
  }
}
