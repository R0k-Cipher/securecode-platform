import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiOkResponse,
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
  RequirePermissions,
} from '../rbac/decorators/require-permissions.decorator';

import {
  PermissionsGuard,
} from '../rbac/guards/permissions.guard';

import {
  PERMISSION_CODES,
} from '../rbac/types/permission-code.type';

import {
  GithubInstallationCallbackDto,
} from './dto/github-installation-callback.dto';

import {
  ListInstallationRepositoriesDto,
} from './dto/list-installation-repositories.dto';

import {
  ImportGithubRepositoryDto,
} from './dto/import-github-repository.dto';

import {
  GithubAppService,
} from './github-app.service';

@ApiTags(
  'GitHub App',
)
@Controller()
export class GithubAppController {
  constructor(
    private readonly githubAppService:
      GithubAppService,
  ) {}

  /*
   * ============================================================
   * Installation URL
   * ============================================================
   */

  @Get(
    'organizations/:organizationId/projects/:projectId/github-app/installation-url',
  )
  @ApiBearerAuth()
  @UseGuards(
    AuthGuard('jwt'),
    PermissionsGuard,
  )
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_CREATE,
  )
  @ApiOperation({
    summary:
      "Générer l'URL d'installation de la GitHub App",
  })
  @ApiOkResponse({
    description:
      "URL sécurisée d'installation GitHub.",
  })
  createInstallationUrl(
    @Param(
      'organizationId',
      new ParseUUIDPipe(),
    )
    organizationId:
      string,

    @Param(
      'projectId',
      new ParseUUIDPipe(),
    )
    projectId:
      string,

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.githubAppService
      .createInstallationUrl(
        organizationId,
        projectId,
        user.id,
      );
  }

  /*
   * ============================================================
   * GitHub callback
   *
   * IMPORTANT :
   * Cette route est volontairement PUBLIQUE.
   *
   * GitHub ne possède pas le JWT SecureCode de l'utilisateur.
   * La sécurité repose sur :
   *
   * - le state UUID ;
   * - GithubInstallationPending ;
   * - son expiration ;
   * - la vérification GitHub de l'installation ;
   * - la vérification GITHUB_APP_ID ;
   * - les vérifications tenant/RBAC effectuées après résolution
   *   du pending.
   * ============================================================
   */

  @Get(
    'github-app/callback',
  )
  @ApiOperation({
    summary:
      "Finaliser l'installation de la GitHub App",
  })
  completeInstallation(
    @Query()
    query:
      GithubInstallationCallbackDto,
  ) {
    return this.githubAppService
      .completeInstallation(
        query.installation_id,
        query.state,
      );
  }

  /*
   * ============================================================
   * Installation token
   * ============================================================
   */

  @Post(
    'organizations/:organizationId/github-app/connections/:connectionId/access-token',
  )
  @ApiBearerAuth()
  @UseGuards(
    AuthGuard('jwt'),
    PermissionsGuard,
  )
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_READ,
  )
  @ApiOperation({
    summary:
      "Générer un jeton temporaire d'installation GitHub",
  })
  createInstallationToken(
    @Param(
      'organizationId',
      new ParseUUIDPipe(),
    )
    organizationId:
      string,

    @Param(
      'connectionId',
      new ParseUUIDPipe(),
    )
    connectionId:
      string,

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.githubAppService
      .createInstallationAccessToken(
        organizationId,
        connectionId,
        user.id,
      );
  }

  /*
   * ============================================================
   * GitHub repositories
   * ============================================================
   */

  @Get(
    'organizations/:organizationId/github-app/connections/:gitConnectionId/repositories',
  )
  @ApiBearerAuth()
  @UseGuards(
    AuthGuard('jwt'),
    PermissionsGuard,
  )
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_READ,
  )
  @ApiOperation({
    summary:
      'Lister les repositories accessibles par une installation GitHub',
  })
  listInstallationRepositories(
    @Param(
      'organizationId',
      new ParseUUIDPipe(),
    )
    organizationId:
      string,

    @Param(
      'gitConnectionId',
      new ParseUUIDPipe(),
    )
    gitConnectionId:
      string,

    @Query()
    query:
      ListInstallationRepositoriesDto,

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.githubAppService
      .listRepositories({
        organizationId,

        gitConnectionId,

        userId:
          user.id,

        page:
          query.page,

        perPage:
          query.perPage,

        search:
          query.search,
      });
  }

  /*
   * ============================================================
   * Import repository
   * ============================================================
   */

  @Post(
    'organizations/:organizationId/projects/:projectId/github-app/repositories/import',
  )
  @ApiBearerAuth()
  @UseGuards(
    AuthGuard('jwt'),
    PermissionsGuard,
  )
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_CREATE,
  )
  @ApiOperation({
    summary:
      'Importer un repository GitHub et déclencher sa première synchronisation',
  })
  importRepository(
    @Param(
      'organizationId',
      new ParseUUIDPipe(),
    )
    organizationId:
      string,

    @Param(
      'projectId',
      new ParseUUIDPipe(),
    )
    projectId:
      string,

    @Body()
    dto:
      ImportGithubRepositoryDto,

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.githubAppService
      .importRepository(
        {
          ...dto,

          organizationId,

          projectId,
        },

        user.id,
      );
  }
}
