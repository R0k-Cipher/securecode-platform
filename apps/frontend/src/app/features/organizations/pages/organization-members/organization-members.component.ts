import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  FormsModule,
} from '@angular/forms';

import {
  ActivatedRoute,
} from '@angular/router';

import {
  ApiClientService,
} from '../../../../core/api/api-client.service';

import {
  AuthContextService,
} from '../../../../core/auth/auth-context.service';

import {
  PERMISSIONS,
} from '../../../../core/auth/auth-context.models';

import {
  OrganizationMembersService,
  type OrganizationInvitation,
  type OrganizationMember,
  type OrganizationProjectOption,
  type OrganizationRole,
  type ProjectRoleOption,
} from '../../services/organization-members.service';

@Component({
  selector:
    'app-organization-members',

  standalone:
    true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl:
    './organization-members.component.html',

  styleUrl:
    './organization-members.component.scss',
})
export class OrganizationMembersComponent {
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly api =
    inject(
      ApiClientService,
    );

  private readonly service =
    inject(
      OrganizationMembersService,
    );

  private readonly authContext =
    inject(
      AuthContextService,
    );

  readonly organizationId =
    this.route.snapshot.paramMap
      .get(
        'organizationId',
      )!;

  /*
  |--------------------------------------------------------------------------
  | Permissions
  |--------------------------------------------------------------------------
  */

  readonly canReadMembers =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS.MEMBER_READ,
          ),
    );

  readonly canInviteMembers =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS.MEMBER_INVITE,
          ),
    );

  readonly canUpdateMembers =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS.MEMBER_UPDATE,
          ),
    );

  readonly canDeleteMembers =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS.MEMBER_DELETE,
          ),
    );

  readonly canReadInvitations =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS.INVITATION_READ,
          ),
    );

  readonly canCancelInvitations =
    computed(
      () =>
        this.authContext
          .canOrganization(
            PERMISSIONS.INVITATION_CANCEL,
          ),
    );

    readonly projectSearch =
      signal(
        '',
      );

    readonly projectSearchOpen =
      signal(
        false,
      );

    readonly projectSearchResultCount =
    computed(
      () =>
        this.availableProjects()
          .length,
    );

  /*
  |--------------------------------------------------------------------------
  | Data
  |--------------------------------------------------------------------------
  */

  readonly members =
    signal<
      OrganizationMember[]
    >(
      [],
    );

  readonly invitations =
    signal<
      OrganizationInvitation[]
    >(
      [],
    );

  readonly roles =
    signal<
      OrganizationRole[]
    >(
      [],
    );

  readonly projects =
    signal<
      OrganizationProjectOption[]
    >(
      [],
    );

  /*
  |--------------------------------------------------------------------------
  | Invitation form
  |--------------------------------------------------------------------------
  */

  readonly inviteOpen =
    signal(
      false,
    );

  readonly email =
    signal(
      '',
    );

  readonly roleId =
    signal(
      '',
    );

  readonly sending =
    signal(
      false,
    );

  readonly message =
    signal<
      string | null
    >(
      null,
    );

  readonly devToken =
    signal<
      string | null
    >(
      null,
    );

  /*
  |--------------------------------------------------------------------------
  | Project assignment selector
  |--------------------------------------------------------------------------
  */

  readonly firstName =
    signal(
      '',
    );

  readonly lastName =
    signal(
      '',
    );


  readonly selectedProjectId =
    signal(
      '',
    );

  readonly selectedProjectRoleCode =
    signal(
      'VIEWER',
    );

  readonly selectedProjects =
    signal<
      Record<
        string,
        string
      >
    >(
      {},
    );

  readonly projectRoles:
    ProjectRoleOption[] = [
      {
        code:
          'PROJECT_ADMIN',

        name:
          'Project Admin',
      },

      {
        code:
          'MANAGER',

        name:
          'Manager',
      },

      {
        code:
          'SECURITY_ANALYST',

        name:
          'Security Analyst',
      },

      {
        code:
          'DEVELOPER',

        name:
          'Developer',
      },

      {
        code:
          'AUDITOR',

        name:
          'Auditor',
      },

      {
        code:
          'VIEWER',

        name:
          'Viewer',
      },
    ];

readonly invitationRoles =
  computed(
    () =>
      this.roles()
        .filter(
          role =>
            [
              'ADMIN',
              'MANAGER',
              'SECURITY_ANALYST',
              'DEVELOPER',
              'AUDITOR',
              'VIEWER',
              'MEMBER',
            ].includes(
              role.code,
            ) &&
            (
              !role.scope ||
              role.scope ===
                'ORGANIZATION'
            ),
        ),
  );

readonly availableProjects =
  computed(
    () => {
      const query =
        this.projectSearch()
          .trim()
          .toLocaleLowerCase();

      const selected =
        this.selectedProjects();

      return this.projects()
        .filter(
          project =>
            !selected[
              project.id
            ],
        )
        .filter(
          project => {
            if (!query) {
              return true;
            }

            const searchableText =
              [
                project.name,
                project.slug ?? '',
              ]
                .join(' ')
                .toLocaleLowerCase();

            return searchableText
              .includes(
                query,
              );
          },
        )
        .sort(
          (
            first,
            second,
          ) =>
            first.name.localeCompare(
              second.name,
              'fr',
              {
                sensitivity:
                  'base',
              },
            ),
        );
    },
  );

  readonly selectedProjectEntries =
    computed(
      () => {
        const selected =
          this.selectedProjects();

        return Object.entries(
          selected,
        )
          .map(
            (
              [
                projectId,
                roleCode,
              ],
            ) => {
              const project =
                this.projects()
                  .find(
                    item =>
                      item.id ===
                      projectId,
                  );

              const role =
                this.projectRoles
                  .find(
                    item =>
                      item.code ===
                      roleCode,
                  );

              return {
                projectId,

                projectName:
                  project?.name ??
                  projectId,

                projectSlug:
                  project?.slug ??
                  null,

                roleCode,

                roleName:
                  role?.name ??
                  roleCode,
              };
            },
          );
      },
    );

  readonly selectedProjectsCount =
    computed(
      () =>
        Object.keys(
          this.selectedProjects(),
        ).length,
    );

  /*
  |--------------------------------------------------------------------------
  | Stats
  |--------------------------------------------------------------------------
  */

  readonly activeMembersCount =
    computed(
      () =>
        this.members()
          .length,
    );

  readonly pendingInvitationsCount =
    computed(
      () =>
        this.invitations()
          .filter(
            invitation =>
              this.invitationStatus(
                invitation,
              ) ===
              'EN ATTENTE',
          )
          .length,
    );

  constructor() {
    this.load();
  }

  /*
  |--------------------------------------------------------------------------
  | Load
  |--------------------------------------------------------------------------
  */

  selectProjectFromSearch(
    project:
      OrganizationProjectOption,
  ):
    void {
    this.selectedProjectId.set(
      project.id,
    );

    this.projectSearch.set(
      project.name,
    );

    this.projectSearchOpen.set(
      false,
    );
  }

  clearProjectSelection():
    void {
    this.selectedProjectId.set(
      '',
    );

    this.projectSearch.set(
      '',
    );

    this.projectSearchOpen.set(
      false,
    );
  }

  load():
    void {
    if (
      this.canReadMembers()
    ) {
      this.service
        .members(
          this.organizationId,
        )
        .subscribe({
          next:
            response => {
              this.members.set(
                response.data,
              );
            },

          error:
            () => {
              this.members.set(
                [],
              );
            },
        });
    }

    if (
      this.canReadInvitations()
    ) {
      this.service
        .invitations(
          this.organizationId,
        )
        .subscribe({
          next:
            response => {
              this.invitations.set(
                response.data,
              );
            },

          error:
            () => {
              this.invitations.set(
                [],
              );
            },
        });
    }

    if (
      !this.canInviteMembers()
    ) {
      return;
    }

    this.api
      .get<{
        data:
          OrganizationProjectOption[];
      }>(
        `/organizations/${this.organizationId}/projects`,
      )
      .subscribe({
        next:
          response => {
            this.projects.set(
              response.data,
            );
          },

        error:
          () => {
            this.projects.set(
              [],
            );
          },
      });

    this.api
      .get<
        OrganizationRole[]
      >(
        `/organizations/${this.organizationId}/roles`,
      )
      .subscribe({
        next:
          roles => {
            this.roles.set(
              roles,
            );

            const availableRoles =
              roles.filter(
                role =>
                  (
                    role.code ===
                      'MEMBER' ||
                    role.code ===
                      'ADMIN'
                  ) &&
                  (
                    !role.scope ||
                    role.scope ===
                      'ORGANIZATION'
                  ),
              );

            if (
              !this.roleId() &&
              availableRoles.length
            ) {
          availableRoles.find(
            role =>
              role.code ===
              'VIEWER',
          )?.id ??
          availableRoles.find(
            role =>
              role.code ===
              'MEMBER',
          )?.id ??
          availableRoles[0]?.id ??
          ''
            }
          },

        error:
          () => {
            this.roles.set(
              [],
            );
          },
      });
  }

  /*
  |--------------------------------------------------------------------------
  | Invitation modal
  |--------------------------------------------------------------------------
  */

  openInviteModal():
    void {
    if (
      !this.canInviteMembers()
    ) {
      return;
    }

    this.message.set(
      null,
    );

    this.devToken.set(
      null,
    );

    this.inviteOpen.set(
      true,
    );
  }

  closeInviteModal():
    void {
    if (
      this.sending()
    ) {
      return;
    }

    this.inviteOpen.set(
      false,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Project assignments
  |--------------------------------------------------------------------------
  */

  addProjectAccess():
    void {
    const projectId =
      this.selectedProjectId();

    const roleCode =
      this.selectedProjectRoleCode();

    if (
      !projectId ||
      !roleCode
    ) {
      return;
    }

    this.selectedProjects.set({
      ...this.selectedProjects(),

      [projectId]:
        roleCode,
    });

    this.selectedProjectId.set(
      '',
    );

    this.selectedProjectRoleCode.set(
      'VIEWER',
    );

    this.projectSearch.set(
      '',
    );

    this.projectSearchOpen.set(
      false,
    );

  }

  removeProjectAccess(
    projectId:
      string,
  ):
    void {
    const next = {
      ...this.selectedProjects(),
    };

    delete next[
      projectId
    ];

    this.selectedProjects.set(
      next,
    );
  }

  updateSelectedProjectRole(
    projectId:
      string,

    roleCode:
      string,
  ):
    void {
    if (
      !this.selectedProjects()[
        projectId
      ]
    ) {
      return;
    }

    this.selectedProjects.set({
      ...this.selectedProjects(),

      [projectId]:
        roleCode,
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Invite
  |--------------------------------------------------------------------------
  */

  sendInvitation():
    void {
    if (
      !this.canInviteMembers()
    ) {
      this.message.set(
        "Vous n'avez pas la permission d'inviter un membre.",
      );

      return;
    }

    const email =
      this.email()
        .trim();

    const firstName =
      this.firstName()
        .trim();

    const lastName =
      this.lastName()
        .trim();

    const roleId =
      this.roleId();

    if (!email) {
      this.message.set(
        'Veuillez renseigner une adresse email.',
      );

      return;
    }

    if (
      !firstName ||
      !lastName
    ) {
      this.message.set(
        'Le prénom et le nom sont obligatoires pour inviter un nouvel utilisateur.',
      );

      return;
    }

    if (!roleId) {
      this.message.set(
        "Veuillez sélectionner un rôle d'organisation.",
      );

      return;
    }

    const organizationRole =
      this.invitationRoles()
        .find(
          role =>
            role.id ===
            roleId,
        );

    if (
      !organizationRole
    ) {
      this.message.set(
        "Le rôle organisation sélectionné n'est pas valide.",
      );

      return;
    }

    const projects =
      Object.entries(
        this.selectedProjects(),
      )
        .map(
          (
            [
              projectId,
              roleCode,
            ],
          ) => ({
            projectId,

            roleCode,
          }),
        );

    this.sending.set(
      true,
    );

    this.message.set(
      null,
    );

    this.devToken.set(
      null,
    );

    this.service
      .invite(
        this.organizationId,
        {
          email,

          firstName,

          lastName,

          roleId:
            organizationRole.id,

          organizationRoleCode:
            organizationRole.code as
              'MEMBER' |
              'ADMIN',

          projects,
        },
      )
      .subscribe({
        next:
          response => {
            this.sending.set(
              false,
            );

            this.message.set(
              response.message,
            );

            this.devToken.set(
              response.invitationToken ??
              null,
            );

            this.resetInvitationForm();

            this.inviteOpen.set(
              false,
            );

            this.load();
          },

        error:
          error => {
            this.sending.set(
              false,
            );

            this.message.set(
              error?.error?.message ??
              'Impossible d’envoyer l’invitation.',
            );
          },
      });
  }

  private resetInvitationForm():
    void {
    this.email.set(
      '',
    );

    this.firstName.set(
      '',
    );

    this.lastName.set(
      '',
    );

    this.selectedProjects.set(
      {},
    );

    this.selectedProjectId.set(
      '',
    );

    this.selectedProjectRoleCode.set(
      'VIEWER',
    );

    this.projectSearch.set(
      '',
    );

    this.projectSearchOpen.set(
      false,
    );

  }

  /*
  |--------------------------------------------------------------------------
  | Members
  |--------------------------------------------------------------------------
  */

  changeRole(
    member:
      OrganizationMember,

    roleId:
      string,
  ):
    void {
    if (
      !this.canUpdateMembers() ||
      member.role.code ===
        'OWNER'
    ) {
      return;
    }

    this.service
      .updateRole(
        this.organizationId,
        member.id,
        roleId,
      )
      .subscribe(
        () =>
          this.load(),
      );
  }

  remove(
    member:
      OrganizationMember,
  ):
    void {
    if (
      !this.canDeleteMembers() ||
      member.role.code ===
        'OWNER'
    ) {
      return;
    }

    if (
      !window.confirm(
        `Retirer ${member.user.email} de l'organisation ?`,
      )
    ) {
      return;
    }

    this.service
      .remove(
        this.organizationId,
        member.id,
      )
      .subscribe(
        () =>
          this.load(),
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Invitations
  |--------------------------------------------------------------------------
  */

  cancelInvitation(
    invitation:
      OrganizationInvitation,
  ):
    void {
    if (
      !this.canCancelInvitations()
    ) {
      return;
    }

    this.service
      .cancelInvitation(
        this.organizationId,
        invitation.id,
      )
      .subscribe(
        () =>
          this.load(),
      );
  }

  invitationStatus(
    invitation:
      OrganizationInvitation,
  ):
    string {
    if (
      invitation.acceptedAt
    ) {
      return 'ACCEPTÉE';
    }

    if (
      invitation.revokedAt
    ) {
      return 'ANNULÉE';
    }

    if (
      new Date(
        invitation.expiresAt,
      ) <
      new Date()
    ) {
      return 'EXPIRÉE';
    }

    return 'EN ATTENTE';
  }

  memberInitials(
    member:
      OrganizationMember,
  ):
    string {
    const first =
      member.user.firstName
        ?.charAt(0) ??
      '';

    const last =
      member.user.lastName
        ?.charAt(0) ??
      '';

    return (
      `${first}${last}`
        .toUpperCase() ||
      'U'
    );
  }
}
