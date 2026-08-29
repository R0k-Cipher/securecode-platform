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
} from '@angular/router';

import {
  ApiClientService,
} from '../../../../core/api/api-client.service';

import {
  OrganizationMembersService,
  type OrganizationInvitation,
  type OrganizationMember,
  type OrganizationRole,
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

  readonly organizationId =
    this.route.snapshot.paramMap
      .get(
        'organizationId',
      )!;

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

  constructor() {
    this.load();
  }

  load():
    void {
    this.service
      .members(
        this.organizationId,
      )
      .subscribe(
        (
          response,
        ) =>
          this.members.set(
            response.data,
          ),
      );

    this.service
      .invitations(
        this.organizationId,
      )
      .subscribe(
        (
          response,
        ) =>
          this.invitations.set(
            response.data,
          ),
      );

    this.api
      .get<
        OrganizationRole[]
      >(
        `/organizations/${this.organizationId}/roles`,
      )
      .subscribe(
        (
          roles,
        ) => {
          this.roles.set(
            roles,
          );

          if (
            !this.roleId() &&
            roles.length
          ) {
            this.roleId.set(
              roles.find(
                (
                  role,
                ) =>
                  role.code ===
                  'MEMBER',
              )?.id ??
              roles[0].id,
            );
          }
        },
      );
  }

  sendInvitation():
    void {
    const email =
      this.email()
        .trim();

    const roleId =
      this.roleId();

    if (
      !email ||
      !roleId
    ) {
      return;
    }

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
        email,
        roleId,
      )
      .subscribe({
        next: (
          response,
        ) => {
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

          this.email.set(
            '',
          );

          this.inviteOpen.set(
            false,
          );

          this.load();
        },

        error: (
          error,
        ) => {
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

  changeRole(
    member:
      OrganizationMember,

    roleId:
      string,
  ):
    void {
    if (
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

  cancelInvitation(
    invitation:
      OrganizationInvitation,
  ):
    void {
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
}
