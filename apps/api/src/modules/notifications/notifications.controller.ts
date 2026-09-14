import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import {
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

import type {
  AuthenticatedUser,
} from '../auth/interfaces/jwt-payload.interface';

import {
  NotificationsService,
} from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications:
      NotificationsService,
  ) {}

  @Get()
  list(
    @CurrentUser()
    user: AuthenticatedUser,

    @Query('unreadOnly')
    unreadOnly?: string,

    @Query('limit')
    limit?: string,
  ) {
    return this.notifications
      .list(
        user.id,

        unreadOnly ===
          'true',

        Number(
          limit ??
          50,
        ),
      );
  }

  @Get('unread-count')
  unreadCount(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.notifications
      .unreadCount(
        user.id,
      );
  }

  @Patch('read-all')
  markAllRead(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.notifications
      .markAllRead(
        user.id,
      );
  }

  @Patch(':notificationId/read')
  markRead(
    @CurrentUser()
    user: AuthenticatedUser,

    @Param(
      'notificationId',
    )
    notificationId:
      string,
  ) {
    return this.notifications
      .markRead(
        user.id,
        notificationId,
      );
  }
}
