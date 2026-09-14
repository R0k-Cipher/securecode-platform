import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
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
  AuditService,
} from './audit.service';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller()
export class CustomerAuditController {
  constructor(
    private readonly auditService:
      AuditService,
  ) {}

  /*
  |--------------------------------------------------------------------------
  | Audit organisation
  |--------------------------------------------------------------------------
  */

  @Get(
    'organizations/:organizationId/audit-logs',
  )
  @RequirePermissions(
    PERMISSION_CODES.AUDIT_LOG_READ,
  )
  @ApiOperation({
    summary:
      "Consulter les journaux d'audit visibles dans l'organisation",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 200,
  })
  async organizationLogs(
    @Param(
      'organizationId',
      ParseUUIDPipe,
    )
    organizationId: string,

    @CurrentUser()
    user: AuthenticatedUser,

    @Query('limit')
    limit?: string,
  ) {
    return {
      data:
        await this.auditService
          .getOrganizationLogsForUser(
            organizationId,
            user.id,
            {
              take:
                this.parseLimit(
                  limit,
                  200,
                ),
            },
          ),
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Audit projet
  |--------------------------------------------------------------------------
  */

  @Get(
    'organizations/:organizationId/projects/:projectId/audit-logs',
  )
  @RequirePermissions(
    PERMISSION_CODES.AUDIT_LOG_READ,
  )
  @ApiOperation({
    summary:
      "Consulter les journaux d'audit d'un projet",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 200,
  })
  async projectLogs(
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

    @Query('limit')
    limit?: string,
  ) {
    return {
      data:
        await this.auditService
          .getProjectLogsForUser(
            organizationId,
            projectId,
            user.id,
            {
              take:
                this.parseLimit(
                  limit,
                  200,
                ),
            },
          ),
    };
  }

  private parseLimit(
    value: string | undefined,
    defaultValue: number,
  ): number {
    if (!value) {
      return defaultValue;
    }

    const parsed =
      Number(value);

    if (
      !Number.isFinite(parsed)
    ) {
      return defaultValue;
    }

    return Math.max(
      1,
      Math.trunc(parsed),
    );
  }
}
