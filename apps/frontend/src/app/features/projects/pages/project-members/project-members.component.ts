import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  FormsModule,
} from '@angular/forms';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  finalize,
  forkJoin,
} from 'rxjs';

import {
  AuthContextService,
} from '../../../../core/auth/auth-context.service';

import {
  PERMISSIONS,
} from '../../../../core/auth/auth-context.models';

import {
  OrganizationMembersService,
  type OrganizationMember,
} from '../../../organizations/services/organization-members.service';

import {
  ProjectsService,
} from '../../services/projects.service';

import {
  ProjectMembersService,
  type ProjectMember,
  type ProjectRole,
  type ProjectRoleCode,
} from '../../services/project-members.service';

import type {
  Project,
} from '../../models/project.models';

@Component({
  selector:
    'app-project-members',

  standalone:
    true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl:
    './project-members.component.html',

  styleUrl:
    './project-members.component.scss',
})
export class ProjectMembersComponent
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

  private readonly projectMembersService =
    inject(
      ProjectMembersService,
    );

  private readonly organizationMembersService =
    inject(
      OrganizationMembersService,
    );

  private readonly projectsService =
    inject(
      ProjectsService,
    );

  private readonly authContext =
    inject(
      AuthContextService,
    );

  readonly members =
    signal<ProjectMember[]>(
      [],
    );

  readonly organizationMembers =
    signal<OrganizationMember[]>(
      [],
    );

  readonly roles =
    signal<ProjectRole[]>(
      [],
    );

  readonly project =
    signal<Project | null>(
      null,
    );

  readonly loading =
    signal(
      true,
    );

  readonly saving =
    signal(
      false,
    );

  readonly removingUserId =
    signal<string | null>(
      null,
    );

  readonly updatingUserId =
    signal<string | null>(
      null,
    );

  readonly error =
    signal<string | null>(
      null,
    );

  readonly success =
    signal<string | null>(
      null,
    );

  readonly addFormOpen =
    signal(
      false,
    );

  readonly selectedUserId =
    signal(
      '',
    );

  readonly selectedRoleCode =
    signal<ProjectRoleCode>(
      'DEVELOPER',
    );

  organizationId =
    '';

  projectId =
    '';

  readonly canReadMembers =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.PROJECT_MEMBER_READ,
            ),
        ),
    );

  readonly canManageMembers =
    computed(
      () =>
        Boolean(
          this.projectId &&
          this.authContext
            .canProject(
              this.projectId,
              PERMISSIONS.PROJECT_MEMBER_MANAGE,
            ),
        ),
    );

  readonly availableOrganizationMembers =
    computed(
      () => {
        const existingUserIds =
          new Set(
            this.members()
              .map(
                member =>
                  member.userId,
              ),
          );

        return this.organizationMembers()
          .filter(
            member =>
              member.user.status ===
                'ACTIVE' &&
              !existingUserIds.has(
                member.user.id,
              ),
          );
      },
    );

  ngOnInit():
    void {
    this.organizationId =
      this.route.snapshot.paramMap
        .get(
          'organizationId',
        ) ??
      '';

    this.projectId =
      this.route.snapshot.paramMap
        .get(
          'projectId',
        ) ??
      '';

    if (
      !this.organizationId ||
      !this.projectId
    ) {
      this.error.set(
        'Organisation ou projet invalide.',
      );

      this.loading.set(
        false,
      );

      return;
    }

    if (
      !this.canReadMembers()
    ) {
      this.error.set(
        "Vous n'avez pas l'autorisation de consulter les membres de ce projet.",
      );

      this.loading.set(
        false,
      );

      return;
    }

    this.load();
  }

  load():
    void {
    if (
      !this.canReadMembers()
    ) {
      return;
    }

    this.loading.set(
      true,
    );

    this.error.set(
      null,
    );

    const requests: {
      project:
        ReturnType<
          ProjectsService['getOne']
        >;

      members:
        ReturnType<
          ProjectMembersService['list']
        >;

      roles:
        ReturnType<
          ProjectMembersService['roles']
        >;

      organizationMembers?:
        ReturnType<
          OrganizationMembersService['members']
        >;
    } = {
      project:
        this.projectsService.getOne(
          this.organizationId,
          this.projectId,
        ),

      members:
        this.projectMembersService.list(
          this.organizationId,
          this.projectId,
        ),

      roles:
        this.projectMembersService.roles(
          this.organizationId,
          this.projectId,
        ),
    };

    if (
      this.canManageMembers()
    ) {
      requests.organizationMembers =
        this.organizationMembersService.members(
          this.organizationId,
        );
    }

    forkJoin(
      requests,
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
          response => {
            this.project.set(
              response.project,
            );

            this.members.set(
              response.members,
            );

            this.roles.set(
              response.roles,
            );

            if (
              response.organizationMembers
            ) {
              this.organizationMembers.set(
                response.organizationMembers.data,
              );
            } else {
              this.organizationMembers.set(
                [],
              );
            }

            const defaultRole =
              response.roles.find(
                role =>
                  role.code ===
                  'DEVELOPER',
              ) ??
              response.roles[0];

            if (
              defaultRole
            ) {
              this.selectedRoleCode.set(
                defaultRole.code,
              );
            }
          },

        error:
          error => {
            this.error.set(
              error?.error?.message ??
              'Impossible de charger les membres du projet.',
            );
          },
      });
  }

  openAddForm():
    void {
    if (
      !this.canManageMembers()
    ) {
      return;
    }

    this.success.set(
      null,
    );

    this.error.set(
      null,
    );

    this.selectedUserId.set(
      '',
    );

    const defaultRole =
      this.roles()
        .find(
          role =>
            role.code ===
            'DEVELOPER',
        ) ??
      this.roles()[0];

    if (
      defaultRole
    ) {
      this.selectedRoleCode.set(
        defaultRole.code,
      );
    }

    this.addFormOpen.set(
      true,
    );
  }

  closeAddForm():
    void {
    if (
      this.saving()
    ) {
      return;
    }

    this.addFormOpen.set(
      false,
    );

    this.selectedUserId.set(
      '',
    );
  }

  addMember():
    void {
    if (
      !this.canManageMembers() ||
      this.saving()
    ) {
      return;
    }

    const userId =
      this.selectedUserId();

    const roleCode =
      this.selectedRoleCode();

    if (
      !userId ||
      !roleCode
    ) {
      this.error.set(
        'Sélectionnez un membre et un rôle projet.',
      );

      return;
    }

    this.saving.set(
      true,
    );

    this.error.set(
      null,
    );

    this.success.set(
      null,
    );

    this.projectMembersService
      .add(
        this.organizationId,
        this.projectId,
        {
          userId,
          roleCode,
        },
      )
      .pipe(
        finalize(
          () =>
            this.saving.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          () => {
            this.success.set(
              'Membre ajouté au projet avec succès.',
            );

            this.addFormOpen.set(
              false,
            );

            this.selectedUserId.set(
              '',
            );

            this.load();
          },

        error:
          error => {
            this.error.set(
              error?.error?.message ??
              "Impossible d'ajouter ce membre au projet.",
            );
          },
      });
  }

  updateRole(
    member:
      ProjectMember,

    roleCode:
      string,
  ):
    void {
    if (
      !this.canManageMembers() ||
      this.updatingUserId()
    ) {
      return;
    }

    if (
      roleCode ===
      member.role.code
    ) {
      return;
    }

    const role =
      this.roles()
        .find(
          item =>
            item.code ===
            roleCode,
        );

    if (
      !role
    ) {
      return;
    }

    this.updatingUserId.set(
      member.userId,
    );

    this.error.set(
      null,
    );

    this.success.set(
      null,
    );

    this.projectMembersService
      .updateRole(
        this.organizationId,
        this.projectId,
        member.userId,
        {
          roleCode:
            role.code,
        },
      )
      .pipe(
        finalize(
          () =>
            this.updatingUserId.set(
              null,
            ),
        ),
      )
      .subscribe({
        next:
          () => {
            this.success.set(
              'Rôle projet mis à jour.',
            );

            this.load();
          },

        error:
          error => {
            this.error.set(
              error?.error?.message ??
              'Impossible de modifier le rôle de ce membre.',
            );

            this.load();
          },
      });
  }

  removeMember(
    member:
      ProjectMember,
  ):
    void {
    if (
      !this.canManageMembers() ||
      this.removingUserId()
    ) {
      return;
    }

    const displayName =
      `${member.user.firstName} ${member.user.lastName}`
        .trim() ||
      member.user.email;

    if (
      !window.confirm(
        `Retirer ${displayName} de ce projet ?`,
      )
    ) {
      return;
    }

    this.removingUserId.set(
      member.userId,
    );

    this.error.set(
      null,
    );

    this.success.set(
      null,
    );

    this.projectMembersService
      .remove(
        this.organizationId,
        this.projectId,
        member.userId,
      )
      .pipe(
        finalize(
          () =>
            this.removingUserId.set(
              null,
            ),
        ),
      )
      .subscribe({
        next:
          () => {
            this.success.set(
              'Membre retiré du projet.',
            );

            this.load();
          },

        error:
          error => {
            this.error.set(
              error?.error?.message ??
              'Impossible de retirer ce membre.',
            );
          },
      });
  }

  backToProject():
    void {
    this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
    ]);
  }

  fullName(
    member:
      ProjectMember,
  ):
    string {
    const value =
      `${member.user.firstName} ${member.user.lastName}`
        .trim();

    return (
      value ||
      member.user.email
    );
  }

  organizationMemberName(
    member:
      OrganizationMember,
  ):
    string {
    const value =
      `${member.user.firstName} ${member.user.lastName}`
        .trim();

    return (
      value ||
      member.user.email
    );
  }
}
