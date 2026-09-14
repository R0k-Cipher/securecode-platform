import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
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
  ReportScope,
} from './dto/create-report.dto';

import {
  ReportsService,
} from './reports.service';

@ApiTags('Organization Reports')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/reports',
)
export class OrganizationReportsController {
  constructor(
    private readonly reports:
      ReportsService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Liste
  |--------------------------------------------------------------------------
  */

  @Get()
  @RequirePermissions(
    PERMISSION_CODES
      .ORGANIZATION_REPORT_READ,
  )
  list(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.reports
      .listOrganizationReports(
        organizationId,
        user.id,
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Générer
  |--------------------------------------------------------------------------
  */

  @Post()
  @RequirePermissions(
    PERMISSION_CODES
      .ORGANIZATION_REPORT_EXPORT,
  )
  create(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: CreateReportDto,
  ) {
    return this.reports
      .createOrganizationReport(
        organizationId,
        user.id,
        {
          ...dto,

          scope:
            ReportScope.ORGANIZATION,
        },
      );
  }

  /*
  |--------------------------------------------------------------------------
  | Download
  |--------------------------------------------------------------------------
  */

  @Get(':reportId/download')
  @RequirePermissions(
    PERMISSION_CODES
      .ORGANIZATION_REPORT_READ,
  )
  download(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @Param(
      'reportId',
      ParseUUIDPipe,
    )
    reportId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.reports
      .downloadOrganizationPayload(
        organizationId,
        reportId,
        user.id,
      );
  }
}
