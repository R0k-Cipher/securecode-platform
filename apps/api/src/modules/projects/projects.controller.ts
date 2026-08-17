import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectsService } from './projects.service';

@ApiTags('Projects')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller('organizations/:organizationId/projects')
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
  ) {}

  @Post()
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_CREATE,
  )
  @ApiOperation({
    summary: 'Créer un projet',
  })
  @ApiCreatedResponse({
    description: 'Projet créé avec succès.',
  })
  @ApiParam({
    name: 'organizationId',
    description: "Identifiant UUID de l'organisation",
  })
  create(
    @Param('organizationId')
    organizationId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: CreateProjectDto,
  ) {
    return this.projectsService.create(
      organizationId,
      user.id,
      dto,
    );
  }

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  @ApiOperation({
    summary: "Lister les projets de l'organisation",
  })
  @ApiOkResponse({
    description: 'Liste paginée des projets.',
  })
  @ApiParam({
    name: 'organizationId',
    description: "Identifiant UUID de l'organisation",
  })
  findAll(
    @Param('organizationId')
    organizationId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Query()
    query: ProjectQueryDto,
  ) {
    return this.projectsService.findAll(
      organizationId,
      user.id,
      query,
    );
  }

  @Get(':projectId')
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  @ApiOperation({
    summary: "Afficher les détails d'un projet",
  })
  @ApiParam({
    name: 'organizationId',
    description: "Identifiant UUID de l'organisation",
  })
  @ApiParam({
    name: 'projectId',
    description: 'Identifiant UUID du projet',
  })
  @ApiOkResponse({
    description: 'Détails du projet.',
  })
  findOne(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.projectsService.findOne(
      organizationId,
      projectId,
      user.id,
    );
  }

  @Patch(':projectId')
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_UPDATE,
  )
  @ApiOperation({
    summary: 'Modifier un projet',
  })
  @ApiParam({
    name: 'organizationId',
    description: "Identifiant UUID de l'organisation",
  })
  @ApiParam({
    name: 'projectId',
    description: 'Identifiant UUID du projet',
  })
  @ApiOkResponse({
    description: 'Projet modifié avec succès.',
  })
  update(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(
      organizationId,
      projectId,
      user.id,
      dto,
    );
  }

  @Post(':projectId/archive')
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_ARCHIVE,
  )
  @ApiOperation({
    summary: 'Archiver un projet',
  })
  @ApiParam({
    name: 'organizationId',
    description: "Identifiant UUID de l'organisation",
  })
  @ApiParam({
    name: 'projectId',
    description: 'Identifiant UUID du projet',
  })
  @ApiOkResponse({
    description: 'Projet archivé avec succès.',
  })
  archive(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.projectsService.archive(
      organizationId,
      projectId,
      user.id,
    );
  }

  @Post(':projectId/restore')
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_RESTORE,
  )
  @ApiOperation({
    summary: 'Restaurer un projet archivé',
  })
  @ApiParam({
    name: 'organizationId',
    description: "Identifiant UUID de l'organisation",
  })
  @ApiParam({
    name: 'projectId',
    description: 'Identifiant UUID du projet',
  })
  @ApiOkResponse({
    description: 'Projet restauré avec succès.',
  })
  restore(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.projectsService.restore(
      organizationId,
      projectId,
      user.id,
    );
  }

  @Delete(':projectId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_DELETE,
  )
  @ApiOperation({
    summary: 'Supprimer définitivement un projet',
  })
  @ApiParam({
    name: 'organizationId',
    description: "Identifiant UUID de l'organisation",
  })
  @ApiParam({
    name: 'projectId',
    description: 'Identifiant UUID du projet',
  })
  @ApiOkResponse({
    description: 'Projet supprimé avec succès.',
  })
  remove(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.projectsService.remove(
      organizationId,
      projectId,
      user.id,
    );
  }
}
