import {
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
} from '../rbac/guards/permissions.guard';

import {
  RequirePermissions,
} from '../rbac/decorators/require-permissions.decorator';

import {
  PERMISSION_CODES,
} from '../rbac/types/permission-code.type';

import {
  ListScansDto,
} from './dto/list-scans.dto';

import {
  ScansService,
} from './scans.service';

@ApiTags('Scans')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/projects/:projectId',
)
export class ScansController {
  constructor(
    private readonly scansService:
      ScansService,
  ) {}

  @Get(
    'scans',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  @ApiOperation({
    summary:
      'Lister les scans du projet',
  })
  listProjectScans(
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

    @Query()
    query:
      ListScansDto,
  ) {
    return this.scansService
      .listProjectScans(
        organizationId,
        projectId,
        query,
      );
  }

  @Get(
    'repositories/:repositoryId/scans',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  listRepositoryScans(
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

    @Query()
    query:
      ListScansDto,
  ) {
    return this.scansService
      .listRepositoryScans(
        organizationId,
        projectId,
        repositoryId,
        query,
      );
  }

  @Get(
    'scans/:scanId',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  getScan(
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
      'scanId',
      ParseUUIDPipe,
    )
    scanId: string,
  ) {
    return this.scansService
      .getScan(
        organizationId,
        projectId,
        scanId,
      );
  }

  @Get(
    'scans/:scanId/progress',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  getScanProgress(
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
      'scanId',
      ParseUUIDPipe,
    )
    scanId: string,
  ) {
    return this.scansService
      .getScanProgress(
        organizationId,
        projectId,
        scanId,
      );
  }

  @Post(
    'repositories/:repositoryId/scans',
  )
  @RequirePermissions(
    PERMISSION_CODES.REPOSITORY_SYNC,
  )
  createManualScan(
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
    user:
      AuthenticatedUser,
  ) {
    return this.scansService
      .createManualScan(
        organizationId,
        projectId,
        repositoryId,
        user.id,
      );
  }

  @Get(
    'repositories/:repositoryId/security-overview',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  getRepositorySecurityOverview(
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
    return this.scansService
      .getRepositorySecurityOverview(
        organizationId,
        projectId,
        repositoryId,
      );
  }

  @Get(
    'security-dashboard',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  getSecurityDashboard(
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
    return this.scansService
      .getProjectSecurityDashboard(
        organizationId,
        projectId,
      );
  }

  @Post(
    'scans/:scanId/cancel',
  )
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_UPDATE,
  )
  cancelScan(
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
      'scanId',
      ParseUUIDPipe,
    )
    scanId: string,

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    return this.scansService
      .cancelScan(
        organizationId,
        projectId,
        scanId,
        user.id,
      );
  }
}
