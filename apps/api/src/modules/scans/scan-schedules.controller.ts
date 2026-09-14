import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  ApiBearerAuth,
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
  PermissionsGuard,
  RequirePermissions,
  PERMISSION_CODES,
} from '../rbac';

import {
  UpsertScanScheduleDto,
} from './dto/upsert-scan-schedule.dto';

import {
  ScanSchedulesService,
} from './scan-schedules.service';

@ApiTags('Scan schedules')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/projects/:projectId/repositories/:repositoryId/scan-schedule',
)
export class ScanSchedulesController {
  constructor(
    private readonly scanSchedulesService:
      ScanSchedulesService,
  ) {}

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.SCAN_READ,
  )
  @ApiOperation({
    summary:
      'Afficher la planification du repository',
  })
  get(
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
      'repositoryId',
      ParseUUIDPipe,
    )
    repositoryId: string,
  ) {
    return this.scanSchedulesService.get(
      organizationId,
      projectId,
      repositoryId,
    );
  }

  @Put()
  @RequirePermissions(
    PERMISSION_CODES.SCAN_CREATE,
  )
  @ApiOperation({
    summary:
      'Créer ou modifier la planification du repository',
  })
  upsert(
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
      'repositoryId',
      ParseUUIDPipe,
    )
    repositoryId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto:
      UpsertScanScheduleDto,
  ) {
    return this.scanSchedulesService
      .upsert(
        organizationId,
        projectId,
        repositoryId,
        user.id,
        dto,
      );
  }

  @Delete()
  @RequirePermissions(
    PERMISSION_CODES.SCAN_CREATE,
  )
  @ApiOperation({
    summary:
      'Supprimer la planification du repository',
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
      'repositoryId',
      ParseUUIDPipe,
    )
    repositoryId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.scanSchedulesService
      .remove(
        organizationId,
        projectId,
        repositoryId,
        user.id,
      );
  }
}
