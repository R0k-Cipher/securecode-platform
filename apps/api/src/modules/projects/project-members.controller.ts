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
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import {
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

import type {
  AuthenticatedUser,
} from '../auth/interfaces/jwt-payload.interface';

import {
  PERMISSION_CODES,
  PermissionsGuard,
  RequirePermissions,
} from '../rbac';

import {
  AddProjectMemberDto,
} from './dto/add-project-member.dto';

import {
  UpdateProjectMemberRoleDto,
} from './dto/update-project-member-role.dto';

import {
  ProjectMembersService,
} from './project-members.service';

@ApiTags('Project Members')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/projects/:projectId/members',
)
export class ProjectMembersController {
  constructor(
    private readonly projectMembersService:
      ProjectMembersService,
  ) {}

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_MEMBER_READ,
  )
  @ApiOperation({
    summary:
      'Lister les membres du projet',
  })
  @ApiParam({
    name: 'organizationId',
  })
  @ApiParam({
    name: 'projectId',
  })
  @ApiOkResponse({
    description:
      'Liste des membres du projet.',
  })
  findAll(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,
  ) {
    return this.projectMembersService.findAll(
      organizationId,
      projectId,
    );
  }

  @Get('roles')
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_MEMBER_READ,
  )
  @ApiOperation({
    summary:
      'Lister les rôles projet disponibles',
  })
  findAvailableRoles(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,
  ) {
    return this.projectMembersService.findAvailableRoles(
      organizationId,
      projectId,
    );
  }

  @Post()
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_MEMBER_MANAGE,
  )
  @ApiOperation({
    summary:
      'Affecter un membre de l’organisation au projet',
  })
  @ApiCreatedResponse({
    description:
      'Membre affecté au projet avec succès.',
  })
  add(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: AddProjectMemberDto,
  ) {
    return this.projectMembersService.add(
      organizationId,
      projectId,
      user.id,
      dto.userId,
      dto.roleCode,
    );
  }

  @Patch(':userId/role')
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_MEMBER_MANAGE,
  )
  @ApiOperation({
    summary:
      "Modifier le rôle d'un membre dans ce projet",
  })
  @ApiOkResponse({
    description:
      'Rôle projet modifié avec succès.',
  })
  updateRole(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,

    @Param(
      'userId',
      ParseUUIDPipe,
    )
    targetUserId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: UpdateProjectMemberRoleDto,
  ) {
    return this.projectMembersService.updateRole(
      organizationId,
      projectId,
      targetUserId,
      user.id,
      dto.roleCode,
    );
  }

  @Delete(':userId')
  @HttpCode(
    HttpStatus.OK,
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_MEMBER_MANAGE,
  )
  @ApiOperation({
    summary:
      'Retirer un membre du projet',
  })
  @ApiOkResponse({
    description:
      'Membre retiré du projet.',
  })
  remove(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId: string,

    @Param(
      'userId',
      ParseUUIDPipe,
    )
    targetUserId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.projectMembersService.remove(
      organizationId,
      projectId,
      targetUserId,
      user.id,
    );
  }
}
