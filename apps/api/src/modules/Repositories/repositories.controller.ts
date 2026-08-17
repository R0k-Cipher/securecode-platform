import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { PERMISSION_CODES } from '../rbac/types/permission-code.type';

import { CreateRepositoryDto } from './dto/create-repository.dto';
import { RepositoryQueryDto } from './dto/repository-query.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import { RepositoriesService } from './repositories.service';

@ApiTags('Repositories')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/projects/:projectId/repositories',
)
export class RepositoriesController {
  constructor(
    private readonly repositoriesService:
      RepositoriesService,
  ) {}

  @Post()
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_CREATE,
  )
  @ApiOperation({
    summary:
      'Connecter un dépôt Git à un projet',
  })
  @ApiCreatedResponse({
    description:
      'Dépôt connecté avec succès.',
  })
  @ApiParam({
    name: 'organizationId',
    description:
      'Identifiant UUID de l’organisation',
  })
  @ApiParam({
    name: 'projectId',
    description:
      'Identifiant UUID du projet',
  })
  create(
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

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: CreateRepositoryDto,
  ) {
    return this.repositoriesService.create(
      organizationId,
      projectId,
      user.id,
      dto,
    );
  }

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_READ,
  )
  @ApiOperation({
    summary:
      'Lister les dépôts d’un projet',
  })
  @ApiOkResponse({
    description:
      'Liste paginée des dépôts.',
  })
  findAll(
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

    @Query()
    query: RepositoryQueryDto,
  ) {
    return this.repositoriesService.findAll(
      organizationId,
      projectId,
      query,
    );
  }

  @Get(':repositoryId')
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_READ,
  )
  @ApiOperation({
    summary:
      'Afficher les détails d’un dépôt',
  })
  @ApiOkResponse({
    description:
      'Détails du dépôt.',
  })
  findOne(
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

    @Param(
      'repositoryId',
      new ParseUUIDPipe(),
    )
    repositoryId: string,
  ) {
    return this.repositoriesService.findOne(
      organizationId,
      projectId,
      repositoryId,
    );
  }

  @Patch(':repositoryId')
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_UPDATE,
  )
  @ApiOperation({
    summary:
      'Modifier les informations d’un dépôt',
  })
  @ApiOkResponse({
    description:
      'Dépôt modifié avec succès.',
  })
  update(
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

    @Param(
      'repositoryId',
      new ParseUUIDPipe(),
    )
    repositoryId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: UpdateRepositoryDto,
  ) {
    return this.repositoriesService.update(
      organizationId,
      projectId,
      repositoryId,
      user.id,
      dto,
    );
  }

  @Post(':repositoryId/archive')
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_UPDATE,
  )
  @ApiOperation({
    summary: 'Archiver un dépôt',
  })
  archive(
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

    @Param(
      'repositoryId',
      new ParseUUIDPipe(),
    )
    repositoryId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.repositoriesService.archive(
      organizationId,
      projectId,
      repositoryId,
      user.id,
    );
  }

  @Post(':repositoryId/restore')
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_UPDATE,
  )
  @ApiOperation({
    summary:
      'Restaurer un dépôt archivé',
  })
  restore(
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

    @Param(
      'repositoryId',
      new ParseUUIDPipe(),
    )
    repositoryId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.repositoriesService.restore(
      organizationId,
      projectId,
      repositoryId,
      user.id,
    );
  }

  @Post(':repositoryId/sync')
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_SYNC,
  )
  @ApiOperation({
    summary:
      'Enregistrer la synchronisation d’un dépôt',
  })
  sync(
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

    @Param(
      'repositoryId',
      new ParseUUIDPipe(),
    )
    repositoryId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.repositoriesService
      .markAsSynchronized(
        organizationId,
        projectId,
        repositoryId,
        user.id,
      );
  }

  @Delete(':repositoryId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_DELETE,
  )
  @ApiOperation({
    summary:
      'Supprimer définitivement un dépôt',
  })
  @ApiOkResponse({
    description:
      'Dépôt supprimé avec succès.',
  })
  remove(
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

    @Param(
      'repositoryId',
      new ParseUUIDPipe(),
    )
    repositoryId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.repositoriesService.remove(
      organizationId,
      projectId,
      repositoryId,
      user.id,
    );
  }
}
