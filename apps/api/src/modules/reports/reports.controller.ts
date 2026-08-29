import {
  Body,
  Controller,
  Get,
  Param,
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
  CreateReportDto,
} from './dto/create-report.dto';

import {
  ReportsService,
} from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
)
@Controller(
  'organizations/:organizationId/projects/:projectId/reports',
)
export class ReportsController {
  constructor(
    private readonly reports:
      ReportsService,
  ) {}

  @Get()
  list(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.reports
      .list(
        organizationId,
        projectId,
        user.id,
      );
  }

  @Post()
  create(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Body()
    dto: CreateReportDto,
  ) {
    return this.reports
      .create(
        organizationId,
        projectId,
        user.id,
        dto,
      );
  }

  @Get(':reportId/download')
  download(
    @Param('organizationId')
    organizationId: string,

    @Param('projectId')
    projectId: string,

    @Param('reportId')
    reportId: string,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.reports
      .downloadPayload(
        organizationId,
        projectId,
        reportId,
        user.id,
      );
  }
}
