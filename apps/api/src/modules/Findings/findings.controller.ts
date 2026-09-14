import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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

  /*
  |--------------------------------------------------------------------------
  | Liste des findings du projet
  |--------------------------------------------------------------------------
  */

  @Get('findings')
  @RequirePermissions(
    PERMISSION_CODES.FINDING_READ,
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

    @Query()
    query: ListFindingsDto,
  ) {
    return this.findingsService.list(
      organizationId,
      projectId,
      query,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Findings d'un repository précis
  |--------------------------------------------------------------------------
  */

  @Get(
    'repositories/:repositoryId/findings',
  )
  @RequirePermissions(
    PERMISSION_CODES.FINDING_READ,
  )
  listRepositoryFindings(
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
    query: ListFindingsDto,
  ) {
    return this.findingsService.list(
      organizationId,
      projectId,
      query,
      repositoryId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Findings d'un scan précis
  |--------------------------------------------------------------------------
  */

  @Get(
    'scans/:scanId/findings',
  )
  @RequirePermissions(
    PERMISSION_CODES.FINDING_READ,
  )
  listScanFindings(
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

    @Query()
    query: ListFindingsDto,
  ) {
    return this.findingsService.list(
      organizationId,
      projectId,
      query,
      undefined,
      scanId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Overview
  |--------------------------------------------------------------------------
  */

  @Get('findings/overview')
  @RequirePermissions(
    PERMISSION_CODES.FINDING_READ,
  )
  overview(
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
    return this.findingsService.getOverview(
      organizationId,
      projectId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Détail
  |--------------------------------------------------------------------------
  */

  @Get('findings/:findingId')
  @RequirePermissions(
    PERMISSION_CODES.FINDING_READ,
  )
  getOne(
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
  ) {
    return this.findingsService.getOne(
      organizationId,
      projectId,
      findingId,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Modification du statut
  |--------------------------------------------------------------------------
  */

  @Patch(
    'findings/:findingId/status',
  )
  @RequirePermissions(
    PERMISSION_CODES.FINDING_UPDATE,
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
    dto: UpdateFindingStatusDto,

    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.findingsService.updateStatus(
      organizationId,
      projectId,
      findingId,
      user.id,
      dto,
    );
  }
}
