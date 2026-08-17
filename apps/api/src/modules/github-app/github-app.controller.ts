import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { PERMISSION_CODES } from '../rbac/types/permission-code.type';

import { GithubInstallationCallbackDto } from './dto/github-installation-callback.dto';
import { ListInstallationRepositoriesDto } from './dto/list-installation-repositories.dto';
import { ImportGithubRepositoryDto } from './dto/import-github-repository.dto';

import { GithubAppService } from './github-app.service';

@ApiTags('GitHub App')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller()
export class GithubAppController {
  constructor(
    private readonly githubAppService: GithubAppService,
  ) {}

  /**
   * Générer l’URL d’installation de la GitHub App.
   */
  @Get(
    'organizations/:organizationId/github-app/installation-url',
  )
  @UseGuards(PermissionsGuard)
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
    organizationId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.githubAppService.createInstallationUrl(
      organizationId,
      user.id,
    );
  }

  /**
   * Finaliser l’installation GitHub App.
   *
   * Attention :
   * cette route nécessite un JWT.
   * Le frontend doit recevoir le callback GitHub,
   * puis appeler cette route avec le JWT utilisateur.
   */
  @Get(
    'organizations/:organizationId/github-app/callback',
  )
  @UseGuards(PermissionsGuard)
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_CREATE,
  )
  @ApiOperation({
    summary:
      "Finaliser l'installation de la GitHub App",
  })
  async completeInstallation(
    @Param(
      'organizationId',
      new ParseUUIDPipe(),
    )
    organizationId: string,

    @Query()
    query: GithubInstallationCallbackDto,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    const result =
      await this.githubAppService.completeInstallation(
        query.installation_id,
        query.state,
        user.id,
      );

    if (
      result.connection.organizationId !==
      organizationId
    ) {
      throw new ForbiddenException(
        "L'organisation du callback ne correspond pas.",
      );
    }

    return result;
  }

  /**
   * Générer un token d’installation GitHub temporaire.
   *
   * Cette route devrait idéalement être utilisée
   * uniquement par le backend ou le worker.
   */
  @Post(
    'organizations/:organizationId/github-app/connections/:connectionId/access-token',
  )
  @UseGuards(PermissionsGuard)
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
    organizationId: string,

    @Param(
      'connectionId',
      new ParseUUIDPipe(),
    )
    connectionId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.githubAppService
      .createInstallationAccessToken(
        organizationId,
        connectionId,
        user.id,
      );
  }

  /**
   * Lister les repositories accessibles par
   * une installation GitHub.
   */
  @Get(
    'organizations/:organizationId/github-app/connections/:gitConnectionId/repositories',
  )
  @UseGuards(PermissionsGuard)
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
    organizationId: string,

    @Param(
      'gitConnectionId',
      new ParseUUIDPipe(),
    )
    gitConnectionId: string,

    @Query()
    query: ListInstallationRepositoriesDto,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.githubAppService.listRepositories({
      organizationId,
      gitConnectionId,
      userId: user.id,
      page: query.page,
      perPage: query.perPage,
      search: query.search,
    });
  }

  /**
   * Importer un repository GitHub dans un projet.
   */
  @Post(
    'organizations/:organizationId/projects/:projectId/github-app/repositories/import',
  )
  @UseGuards(PermissionsGuard)
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
    organizationId: string,

    @Param(
      'projectId',
      new ParseUUIDPipe(),
    )
    projectId: string,

    @Body()
    dto: ImportGithubRepositoryDto,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.githubAppService.importRepository(
      {
        ...dto,
        organizationId,
        projectId,
      },
      user.id,
    );
  }
}

