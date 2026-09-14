import {
  Controller,
  Get,
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
  PlatformAdminGuard,
} from '../auth/guards/platform-admin.guard';

import {
  AuditService,
} from './audit.service';

@ApiTags('Platform Admin Audit Logs')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PlatformAdminGuard,
)
@Controller(
  'platform-admin/audit-logs',
)
export class AuditController {
  constructor(
    private readonly auditService:
      AuditService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "Consulter uniquement les journaux d'audit de la plateforme",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 500,
  })
  async list(
    @Query('limit')
    limit?: string,
  ) {
    const parsed =
      Number(
        limit ?? 500,
      );

    return {
      data:
        await this.auditService
          .getPlatformLogs({
            take:
              Number.isFinite(parsed)
                ? Math.max(
                    1,
                    Math.trunc(parsed),
                  )
                : 500,
          }),
    };
  }
}
