import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import {
  ApiOperation,
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
  @ApiOperation({
    summary:
      'Prévisualiser une invitation valide',
  })
  preview(
    @Param('token')
    token: string,
  ) {
    return this.invitations.preview(token);
  }

  @Post(':token/register')
  @ApiOperation({
    summary:
      'Accepter une invitation et activer l’identité organisation',
  })
  register(
    @Param('token')
    token: string,

    @Body()
    dto: RegisterInvitedUserDto,
  ) {
    return this.invitations.registerInvitedUser(
      token,
      dto,
    );
  }
}
