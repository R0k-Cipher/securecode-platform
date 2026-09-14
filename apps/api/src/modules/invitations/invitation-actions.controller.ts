import {
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

import type {
  AuthenticatedUser,
} from '../auth/interfaces/jwt-payload.interface';

import {
  InvitationActionsService,
} from './invitation-actions.service';

@ApiTags('Invitation Actions')
@ApiBearerAuth()
@UseGuards(
  AuthGuard(
    'jwt',
  ),
)
@Controller(
  'organizations/invitations',
)
export class InvitationActionsController {
  constructor(
    private readonly invitations:
      InvitationActionsService,
  ) {}

  /**
   * Legacy :
   * permet à une personne déjà authentifiée d'accepter
   * une invitation reçue sur son email.
   */
  @Post(
    ':invitationId/accept',
  )
  @ApiOperation({
    summary:
      'Accepter une invitation depuis une session existante',
  })
  accept(
    @Param(
      'invitationId',
      ParseUUIDPipe,
    )
    invitationId:
      string,

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.invitations.accept(
      user.id,
      invitationId,
    );
  }

  @Post(
    ':invitationId/decline',
  )
  @ApiOperation({
    summary:
      'Refuser une invitation',
  })
  decline(
    @Param(
      'invitationId',
      ParseUUIDPipe,
    )
    invitationId:
      string,

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.invitations.decline(
      user.id,
      invitationId,
    );
  }
}
