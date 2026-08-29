import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import {
  ApiTags,
} from '@nestjs/swagger';

import {
  RegisterInvitedUserDto,
} from './dto/register-invited-user.dto';

import {
  InvitationsService,
} from './invitations.service';

@ApiTags('Invitation Access')
@Controller('invitations')
export class InvitationsController {
  constructor(
    private readonly invitations:
      InvitationsService,
  ) {}

  @Get(':token')
  preview(
    @Param('token')
    token: string,
  ) {
    return this.invitations
      .preview(
        token,
      );
  }

  @Post(':token/register')
  register(
    @Param('token')
    token: string,

    @Body()
    dto:
      RegisterInvitedUserDto,
  ) {
    return this.invitations
      .registerInvitedUser(
        token,
        dto,
      );
  }
}
