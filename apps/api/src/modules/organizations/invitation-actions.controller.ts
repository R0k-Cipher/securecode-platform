import { Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { InvitationActionsService } from './invitation-actions.service';

@ApiTags('Invitation Actions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('organizations/invitations')
export class InvitationActionsController {
  constructor(private readonly invitations: InvitationActionsService) {}

  @Post(':invitationId/accept')
  accept(@Param('invitationId', ParseUUIDPipe) invitationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitations.accept(user.id, invitationId);
  }

  @Post(':invitationId/decline')
  decline(@Param('invitationId', ParseUUIDPipe) invitationId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invitations.decline(user.id, invitationId);
  }
}
