import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Body,
  Patch,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

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
  ListFindingsDto,
} from './dto/list-findings.dto';

import {
  FindingsService,
} from './findings.service';

import {
  CurrentUser,
} from '../auth/decorators/current-user.decorator';

import type {
  AuthenticatedUser,
} from '../auth/interfaces/jwt-payload.interface';

import {
  UpdateFindingStatusDto,
} from './dto/update-finding-status.dto';

@ApiTags('Findings')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/projects/:projectId',
)
export class FindingsController {
  constructor(
    private readonly findingsService:
      FindingsService,
  ) {}

  @Get(
    'findings',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  list(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId:
      string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId:
      string,

    @Query()
    query:
      ListFindingsDto,
  ) {
    return this.findingsService
      .list(
        organizationId,
        projectId,
        query,
      );
  }

  @Get(
    'repositories/:repositoryId/findings',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  listRepositoryFindings(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId:
      string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId:
      string,

    @Param(
      'repositoryId',
      ParseUUIDPipe,
    )
    repositoryId:
      string,

    @Query()
    query:
      ListFindingsDto,
  ) {
    return this.findingsService
      .list(
        organizationId,
        projectId,
        query,
        repositoryId,
      );
  }

  @Get(
    'scans/:scanId/findings',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  listScanFindings(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId:
      string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId:
      string,

    @Param(
      'scanId',
      ParseUUIDPipe,
    )
    scanId:
      string,

    @Query()
    query:
      ListFindingsDto,
  ) {
    return this.findingsService
      .list(
        organizationId,
        projectId,
        query,
        undefined,
        scanId,
      );
  }

  @Get(
    'findings/overview',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  overview(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId:
      string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId:
      string,
  ) {
    return this.findingsService
      .getOverview(
        organizationId,
        projectId,
      );
  }

  @Get(
    'findings/:findingId',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  getOne(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId:
      string,

    @Param(
      'projectId',
      ParseUUIDPipe,
    )
    projectId:
      string,

    @Param(
      'findingId',
      ParseUUIDPipe,
    )
    findingId:
      string,
  ) {
    return this.findingsService
      .getOne(
        organizationId,
        projectId,
        findingId,
      );
  }

  @Patch(
    'findings/:findingId/status',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_UPDATE,
  )
  updateStatus(
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
      'findingId',
      ParseUUIDPipe,
    )
    findingId: string,

    @Body()
    dto:
      UpdateFindingStatusDto,

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.findingsService
      .updateStatus(
        organizationId,
        projectId,
        findingId,
        user.id,
        dto,
      );
  }
}
