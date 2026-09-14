import {
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
  computed,
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
  ActivatedRoute,
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
  ProjectsService,
} from '../../services/projects.service';

import type {
  Project,
  ProjectPagination,
  ProjectStatus,
} from '../../models/project.models';

import {
  WorkspaceContextService,
} from '../../../../core/context/workspace-context.service';

import {
  AuthContextService,
} from '../../../../core/auth/auth-context.service';


import {
  PERMISSIONS,
} from '../../../../core/auth/auth-context.models';

@Component({
  selector:
    'app-project-list',

  standalone:
    true,

  imports: [
    CommonModule,
    ReactiveFormsModule,
  ],

  templateUrl:
    './project-list.component.html',

  styleUrl:
    './project-list.component.scss',
})
export class ProjectListComponent
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

  private readonly projectsService =
    inject(
      ProjectsService,
    );

  private readonly workspace =
    inject(
      WorkspaceContextService,
    );

  private readonly fb =
    inject(
      FormBuilder,
    );

  private readonly authContext =
    inject(
      AuthContextService,
    );

  private readonly destroy$ =
    new Subject<void>();

  private readonly searchSubject =
    new Subject<string>();

  readonly projects =
    signal<Project[]>([]);

  readonly loading =
    signal(true);

  readonly creating =
    signal(false);

  readonly updating =
    signal(false);

  readonly deleting =
    signal<string | null>(
      null,
    );

  readonly processing =
    signal<string | null>(
      null,
    );

  readonly error =
    signal<string | null>(
      null,
    );

  readonly showCreateModal =
    signal(false);

  readonly showEditModal =
    signal(false);

  readonly editingProject =
    signal<Project | null>(
      null,
    );

  readonly search =
    signal('');

  readonly status =
    signal<
      ProjectStatus |
      null
    >(null);

  readonly pagination =
    signal<ProjectPagination>({
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

  readonly canCreateProject =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS.PROJECT_CREATE,
          ),
    );

  canOpenProject(
    projectId:
      string,
  ): boolean {
    return this.authContext
      .canProject(
        projectId,
        PERMISSIONS.PROJECT_READ,
      );
  }

  canUpdateProject(
    projectId:
      string,
  ): boolean {
    return this.authContext
      .canProject(
        projectId,
        PERMISSIONS.PROJECT_UPDATE,
      );
  }

  canReadProjectMembers(
    projectId:
      string,
  ): boolean {
    return this.authContext
      .canProject(
        projectId,
        PERMISSIONS.PROJECT_MEMBER_READ,
      );
  }

  canArchiveProject(
    projectId:
      string,
  ): boolean {
    return this.authContext
      .canProject(
        projectId,
        PERMISSIONS.PROJECT_ARCHIVE,
      );
  }

  canRestoreProject(
    projectId:
      string,
  ): boolean {
    return this.authContext
      .canProject(
        projectId,
        PERMISSIONS.PROJECT_RESTORE,
      );
  }

  openProjectMembers(
    project:
      Project,

    event:
      Event,
  ): void {
    event.stopPropagation();

    if (
      !this.canReadProjectMembers(
        project.id,
      )
    ) {
      return;
    }

    this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      project.id,
      'members',
    ]);
  }

  canDeleteProject(
    projectId:
      string,
  ): boolean {
    return this.authContext
      .canProject(
        projectId,
        PERMISSIONS.PROJECT_DELETE,
      );
  }

  readonly createForm =
    this.fb.nonNullable.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(200),
        ],
      ],

      slug: [
        '',
        [
          Validators.pattern(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          ),
          Validators.maxLength(200),
        ],
      ],

      description: [
        '',
        [
          Validators.maxLength(3000),
        ],
      ],

      defaultBranch: [
        'main',
        [
          Validators.maxLength(255),
        ],
      ],
    });

  readonly editForm =
    this.fb.nonNullable.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(200),
        ],
      ],

      slug: [
        '',
        [
          Validators.pattern(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          ),
          Validators.maxLength(200),
        ],
      ],

      description: [
        '',
        [
          Validators.maxLength(3000),
        ],
      ],

      defaultBranch: [
        '',
        [
          Validators.maxLength(255),
        ],
      ],
    });

  organizationId =
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

    this.workspace
      .clearProject();

    this.searchSubject
      .pipe(
        debounceTime(350),
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
    if (
      !this.organizationId
    ) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.projectsService
      .list(
        this.organizationId,
        {
          page,

          limit:
            20,

          search:
            search.trim() ||
            undefined,

          status:
            this.status() ??
            undefined,
        },
      )
      .pipe(
        takeUntil(
          this.destroy$,
        ),

        finalize(
          () =>
            this.loading.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          (
            response,
          ) => {
            this.projects.set(
              response.data,
            );

            this.pagination.set(
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
                'Impossible de charger les projets.',
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

  filterStatus(
    status:
      ProjectStatus |
      null,
  ): void {
    this.status.set(
      status,
    );

    this.load(
      1,
    );
  }

  previousPage():
    void {
    const pagination =
      this.pagination();

    if (
      !pagination.hasPreviousPage
    ) {
      return;
    }

    this.load(
      pagination.page -
        1,
    );
  }

  nextPage():
    void {
    const pagination =
      this.pagination();

    if (
      !pagination.hasNextPage
    ) {
      return;
    }

    this.load(
      pagination.page +
        1,
    );
  }

 openCreate():
    void {
    if (
      !this.canCreateProject()
    ) {
      this.error.set(
        "Vous n'avez pas la permission de créer un projet.",
      );

      return;
    }

    this.error.set(null);

    this.createForm
      .reset({
        name:
          '',

        slug:
          '',

        description:
          '',

        defaultBranch:
          'main',
      });

    this.showCreateModal
      .set(true);
  }

  closeCreate():
    void {
    if (
      this.creating()
    ) {
      return;
    }

    this.showCreateModal
      .set(false);
  }

  createProject():
    void {
    if (
      !this.canCreateProject()
    ) {
      this.error.set(
        "Vous n'avez pas la permission de créer un projet.",
      );

      return;
    }

    if (
      this.createForm.invalid ||
      this.creating()
    ) {
      this.createForm
        .markAllAsTouched();

      return;
    }

    const value =
      this.createForm
        .getRawValue();

    this.creating.set(true);
    this.error.set(null);

    this.projectsService
      .create(
        this.organizationId,
        {
          name:
            value.name.trim(),

          slug:
            value.slug.trim() ||
            undefined,

          description:
            value.description
              .trim() ||
            undefined,

          defaultBranch:
            value.defaultBranch
              .trim() ||
            undefined,
        },
      )
      .subscribe({
        next:
          (
            project,
          ) => {

            /*
            |--------------------------------------------------------------------------
            | IMPORTANT
            |--------------------------------------------------------------------------
            |
            | Le backend vient de créer le ProjectMember PROJECT_ADMIN.
            |
            | Le contexte frontend chargé avant la création ne connaît donc pas
            | encore ce nouveau projet.
            |
            | On rafraîchit le contexte AVANT openProject().
            |--------------------------------------------------------------------------
            */

            this.authContext
              .refresh()
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
                    this.showCreateModal
                      .set(false);

                    this.openProject(
                      project,
                    );
                  },

                error:
                  (
                    error,
                  ) => {
                    /*
                    |--------------------------------------------------------------------------
                    | Le projet a bien été créé.
                    |--------------------------------------------------------------------------
                    |
                    | On ne prétend surtout pas que la création a échoué.
                    | Seul le rechargement du contexte RBAC a échoué.
                    |--------------------------------------------------------------------------
                    */

                    this.showCreateModal
                      .set(false);

                    this.error.set(
                      this.readError(
                        error,
                        'Le projet a été créé, mais le contexte des permissions n’a pas pu être actualisé. Rechargez la page.',
                      ),
                    );

                    this.load();
                  },
              });
          },

        error:
          (
            error,
          ) => {
            this.creating.set(
              false,
            );

            this.error.set(
              this.readError(
                error,
                'Impossible de créer le projet.',
              ),
            );
          },
      });
  }

  openEdit(
    project:
      Project,

    event:
      Event,
  ): void {
    event.stopPropagation();

    if (
      !this.canUpdateProject(
        project.id,
      )
    ) {
      this.error.set(
        "Vous n'avez pas la permission de modifier ce projet.",
      );

      return;
    }


    if (
      project.status ===
      'ARCHIVED'
    ) {
      this.error.set(
        'Un projet archivé doit être restauré avant modification.',
      );

      return;
    }

    this.editingProject
      .set(
        project,
      );

    this.editForm
      .reset({
        name:
          project.name,

        slug:
          project.slug,

        description:
          project.description ??
          '',

        defaultBranch:
          project.defaultBranch ??
          '',
      });

    this.showEditModal
      .set(true);
  }

  closeEdit():
    void {
    if (
      this.updating()
    ) {
      return;
    }

    this.showEditModal
      .set(false);

    this.editingProject
      .set(null);
  }

  updateProject():
    void {
    const project =
      this.editingProject();

    if (!project) {
      return;
    }

    if (
      !this.canUpdateProject(
        project.id,
      )
    ) {
      this.error.set(
        "Vous n'avez pas la permission de modifier ce projet.",
      );

      return;
    }

    if (
      this.editForm.invalid ||
      this.updating()
    ) {
      this.editForm
        .markAllAsTouched();

      return;
    }

    const value =
      this.editForm
        .getRawValue();



    if (
      !project ||
      this.editForm.invalid ||
      this.updating()
    ) {
      this.editForm
        .markAllAsTouched();

      return;
    }

    this.updating.set(true);
    this.error.set(null);

    this.projectsService
      .update(
        this.organizationId,
        project.id,
        {
          name:
            value.name.trim(),

          slug:
            value.slug.trim(),

          description:
            value.description
              .trim() ||
            '',

          defaultBranch:
            value.defaultBranch
              .trim() ||
            '',
        },
      )
      .pipe(
        finalize(
          () =>
            this.updating.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          (
            updated,
          ) => {
            this.projects.update(
              (
                projects,
              ) =>
                projects.map(
                  (
                    item,
                  ) =>
                    item.id ===
                    updated.id
                      ? {
                          ...item,
                          ...updated,
                        }
                      : item,
                ),
            );

            this.closeEdit();
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              this.readError(
                error,
                'Impossible de modifier le projet.',
              ),
            );
          },
      });
  }

  archive(
    project:
      Project,

    event:
      Event,
  ): void {
    event.stopPropagation();

    if (
      !this.canArchiveProject(
        project.id,
      )
    ) {
      this.error.set(
        "Vous n'avez pas la permission d'archiver ce projet.",
      );

      return;
    }

    if (
      project.status ===
      'ARCHIVED'
    ) {
      return;
    }

    if (
      !window.confirm(
        `Archiver le projet "${project.name}" ?`,
      )
    ) {
      return;
    }

    this.processing.set(
      project.id,
    );

    this.error.set(null);

    this.projectsService
      .archive(
        this.organizationId,
        project.id,
      )
      .pipe(
        finalize(
          () =>
            this.processing
              .set(null),
        ),
      )
      .subscribe({
        next:
          (
            updated,
          ) => {
            this.replaceProject(
              updated,
            );
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              this.readError(
                error,
                'Impossible d’archiver le projet.',
              ),
            );
          },
      });
  }

  restore(
    project:
      Project,

    event:
      Event,
  ): void {
    event.stopPropagation();

      if (
        !this.canRestoreProject(
          project.id,
        )
      ) {
        this.error.set(
          "Vous n'avez pas la permission de restaurer ce projet.",
        );

        return;
      }

    this.processing.set(
      project.id,
    );

    this.error.set(null);

    this.projectsService
      .restore(
        this.organizationId,
        project.id,
      )
      .pipe(
        finalize(
          () =>
            this.processing
              .set(null),
        ),
      )
      .subscribe({
        next:
          (
            updated,
          ) => {
            this.replaceProject(
              updated,
            );
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              this.readError(
                error,
                'Impossible de restaurer le projet.',
              ),
            );
          },
      });
  }

  remove(
    project:
      Project,

    event:
      Event,
  ): void {
    event.stopPropagation();

    if (
      !this.canDeleteProject(
        project.id,
      )
    ) {
      this.error.set(
        "Vous n'avez pas la permission de supprimer ce projet.",
      );

      return;
    }

    if (
      !window.confirm(
        `Supprimer définitivement "${project.name}" ? Cette opération est irréversible.`,
      )
    ) {
      return;
    }

    if (
      !window.confirm(
        `Supprimer définitivement "${project.name}" ? Cette opération est irréversible.`,
      )
    ) {
      return;
    }

    this.deleting.set(
      project.id,
    );

    this.error.set(null);

    this.projectsService
      .remove(
        this.organizationId,
        project.id,
      )
      .pipe(
        finalize(
          () =>
            this.deleting
              .set(null),
        ),
      )
      .subscribe({
        next:
          () => {
            this.projects.update(
              (
                projects,
              ) =>
                projects.filter(
                  (
                    item,
                  ) =>
                    item.id !==
                    project.id,
                ),
            );

            this.pagination.update(
              (
                pagination,
              ) => ({
                ...pagination,

                total:
                  Math.max(
                    0,
                    pagination.total -
                      1,
                  ),
              }),
            );
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              this.readError(
                error,
                'Impossible de supprimer le projet.',
              ),
            );
          },
      });
  }

  openProject(
    project:
      Project,
  ): void {
    if (
      project.status ===
      'ARCHIVED'
    ) {
      return;
    }

  const projectContext =
    this.authContext
      .getProject(
        project.id,
      );

  if (!projectContext) {
    this.error.set(
      "Vous n'avez pas accès à ce projet.",
    );

    return;
  }

  this.workspace
    .setProject({
      id:
        project.id,

      name:
        project.name,

      slug:
        project.slug,

      status:
        project.status,

      roleCode:
        projectContext.role.code,

      permissions:
        projectContext.permissions,

      ownerOverride:
        projectContext.ownerOverride,
    });

    void this.router
      .navigate([
        '/organizations',
        this.organizationId,
        'projects',
        project.id,
        'dashboard',
      ]);
  }

  private replaceProject(
    updated:
      Project,
  ): void {
    this.projects.update(
      (
        projects,
      ) =>
        projects.map(
          (
            project,
          ) =>
            project.id ===
            updated.id
              ? {
                  ...project,
                  ...updated,
                }
              : project,
        ),
    );
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
