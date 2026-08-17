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
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { PERMISSION_CODES } from '../rbac/types/permission-code.type';

import { CreateGitConnectionDto } from './dto/create-git-connection.dto';
import { GitConnectionQueryDto } from './dto/git-connection-query.dto';
import { UpdateGitConnectionDto } from './dto/update-git-connection.dto';
import { GitConnectionsService } from './git-connections.service';

@ApiTags('Git Connections')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/git-connections',
)
export class GitConnectionsController {
  constructor(
    private readonly gitConnectionsService:
      GitConnectionsService,
  ) {}

  @Post()
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_CREATE,
  )
  @ApiOperation({
    summary:
      'Ajouter une connexion Git à une organisation',
  })
  @ApiCreatedResponse({
    description:
      'Connexion Git créée avec succès.',
  })
  create(
    @Param(
      'organizationId',
      new ParseUUIDPipe(),
    )
    organizationId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: CreateGitConnectionDto,
  ) {
    return this.gitConnectionsService.create(
      organizationId,
      user.id,
      dto,
    );
  }

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_READ,
  )
  @ApiOperation({
    summary:
      'Lister les connexions Git de l’organisation',
  })
  findAll(
    @Param(
      'organizationId',
      new ParseUUIDPipe(),
    )
    organizationId: string,

    @Query()
    query: GitConnectionQueryDto,
  ) {
    return this.gitConnectionsService.findAll(
      organizationId,
      query,
    );
  }

  @Get(':connectionId')
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_READ,
  )
  @ApiOperation({
    summary:
      'Afficher une connexion Git',
  })
  findOne(
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
  ) {
    return this.gitConnectionsService.findOne(
      organizationId,
      connectionId,
    );
  }

  @Patch(':connectionId')
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_UPDATE,
  )
  @ApiOperation({
    summary:
      'Modifier une connexion Git',
  })
  update(
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

    @Body()
    dto: UpdateGitConnectionDto,
  ) {
    return this.gitConnectionsService.update(
      organizationId,
      connectionId,
      user.id,
      dto,
    );
  }

  @Post(':connectionId/revoke')
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_UPDATE,
  )
  @ApiOperation({
    summary:
      'Révoquer une connexion Git',
  })
  revoke(
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
    return this.gitConnectionsService.revoke(
      organizationId,
      connectionId,
      user.id,
    );
  }

  @Post(':connectionId/reactivate')
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_UPDATE,
  )
  @ApiOperation({
    summary:
      'Réactiver une connexion Git',
  })
  reactivate(
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
    return this.gitConnectionsService.reactivate(
      organizationId,
      connectionId,
      user.id,
    );
  }

  @Delete(':connectionId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(
    PERMISSION_CODES.GIT_CONNECTION_DELETE,
  )
  @ApiOperation({
    summary:
      'Supprimer une connexion Git',
  })
  @ApiOkResponse({
    description:
      'Connexion Git supprimée avec succès.',
  })
  remove(
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
    return this.gitConnectionsService.remove(
      organizationId,
      connectionId,
      user.id,
    );
  }
}
