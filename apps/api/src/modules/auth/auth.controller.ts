import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import type {
  Request,
} from 'express';

import {
  AuthContextService,
} from './auth-context.service';

import {
  AuthService,
} from './auth.service';

import {
  CurrentUser,
} from './decorators/current-user.decorator';

import {
  ChangePasswordDto,
} from './dto/change-password.dto';

import {
  LoginDto,
} from './dto/login.dto';

import {
  RefreshTokenDto,
} from './dto/refresh-token.dto';

import {
  JwtAuthGuard,
} from './guards/jwt-auth.guard';

import type {
  AuthenticatedUser,
} from './interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService:
      AuthService,

    private readonly authContextService:
      AuthContextService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Login
  |--------------------------------------------------------------------------
  */

  @Post('login')
  @HttpCode(
    HttpStatus.OK,
  )
  @ApiOkResponse({
    description:
      'Authentification réussie.',
  })
  @ApiUnauthorizedResponse({
    description:
      'Identifiants incorrects.',
  })
  login(
    @Body()
    dto:
      LoginDto,

    @Ip()
    ipAddress:
      string,

    @Req()
    request:
      Request,
  ) {
    return this.authService.login(
      dto,
      {
        ipAddress,

        userAgent:
          request.get(
            'user-agent',
          ),
      },
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Refresh
  |--------------------------------------------------------------------------
  */

  @Post('refresh')
  @HttpCode(
    HttpStatus.OK,
  )
  refresh(
    @Body()
    dto:
      RefreshTokenDto,
  ) {
    return this.authService.refresh(
      dto.refreshToken,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Logout
  |--------------------------------------------------------------------------
  */

  @Post('logout')
  @UseGuards(
    JwtAuthGuard,
  )
  @ApiBearerAuth()
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async logout(
    @CurrentUser()
    user:
      AuthenticatedUser,
  ): Promise<void> {
    await this.authService.logout(
      user.id,
      user.sessionId,
    );
  }

  @Post('logout-all')
  @UseGuards(
    JwtAuthGuard,
  )
  @ApiBearerAuth()
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async logoutAll(
    @CurrentUser()
    user:
      AuthenticatedUser,
  ): Promise<void> {
    await this.authService.logoutAll(
      user,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Current user
  |--------------------------------------------------------------------------
  */

  @Get('me')
  @UseGuards(
    JwtAuthGuard,
  )
  @ApiBearerAuth()
  me(
    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.authService.me(
      user,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | RBAC context
  |--------------------------------------------------------------------------
  */

  @Get('me/context')
  @UseGuards(
    JwtAuthGuard,
  )
  @ApiBearerAuth()
  @ApiOkResponse({
    description:
      'Contexte RBAC complet de la session active.',
  })
  context(
    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.authContextService.getContext(
      user.id,
      user.organizationId,
      user.platformRole,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Change password
  |--------------------------------------------------------------------------
  */

  @Patch('change-password')
  @UseGuards(
    JwtAuthGuard,
  )
  @ApiBearerAuth()
  @HttpCode(
    HttpStatus.NO_CONTENT,
  )
  async changePassword(
    @CurrentUser()
    user:
      AuthenticatedUser,

    @Body()
    dto:
      ChangePasswordDto,
  ): Promise<void> {
    await this.authService.changePassword(
      user,
      dto,
    );
  }
}
