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
} from '../rbac/guards/permissions.guard';

import {
  RequirePermissions,
} from '../rbac/decorators/require-permissions.decorator';

import {
  PERMISSION_CODES,
} from '../rbac/types/permission-code.type';

import {
  CreateReportDto,
} from './dto/create-report.dto';

import {
  ReportsService,
} from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/projects/:projectId/reports',
)
export class ReportsController {
  constructor(
    private readonly reports:
      ReportsService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Liste rapports du projet
  |--------------------------------------------------------------------------
  */

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.REPORT_READ,
  )
  list(
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

    @Query('repositoryId')
    repositoryId?: string,
  ) {
    return this.reports.list(
      organizationId,
      projectId,
      user.id,
      repositoryId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | SCAN / PROJECT
  |--------------------------------------------------------------------------
  */

  @Post()
  @RequirePermissions(
    PERMISSION_CODES.REPORT_EXPORT,
  )
  create(
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
    dto: CreateReportDto,
  ) {
    return this.reports.create(
      organizationId,
      projectId,
      user.id,
      dto,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Download
  |--------------------------------------------------------------------------
  */

  @Get(':reportId/download')
  @RequirePermissions(
    PERMISSION_CODES.REPORT_READ,
  )
  download(
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
      'reportId',
      ParseUUIDPipe,
    )
    reportId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.reports.downloadPayload(
      organizationId,
      projectId,
      reportId,
      user.id,
    );
  }
}
