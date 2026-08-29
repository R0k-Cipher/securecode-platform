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
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
)
@Controller()
export class GithubAppController {
  constructor(
    private readonly githubAppService:
      GithubAppService,
  ) {}

  /*
   * ------------------------------------------------
   * Installation URL
   * ------------------------------------------------
   */

  @Get(
    'organizations/:organizationId/projects/:projectId/github-app/installation-url',
  )
  @UseGuards(
    PermissionsGuard,
  )
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_CREATE,
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

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.githubAppService
      .completeInstallation(
        query.installation_id,
        user.id,
      );
  }

  /*
   * ------------------------------------------------
   * Installation token
   * ------------------------------------------------
   */

  @Post(
    'organizations/:organizationId/github-app/connections/:connectionId/access-token',
  )
  @UseGuards(
    PermissionsGuard,
  )
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_SYNC,
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
   * ------------------------------------------------
   * GitHub repositories
   * ------------------------------------------------
   */

  @Get(
    'organizations/:organizationId/github-app/connections/:gitConnectionId/repositories',
  )
  @UseGuards(
    PermissionsGuard,
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
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
   * ------------------------------------------------
   * Import repository
   * ------------------------------------------------
   */

  @Post(
    'organizations/:organizationId/projects/:projectId/github-app/repositories/import',
  )
  @UseGuards(
    PermissionsGuard,
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_UPDATE,
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
