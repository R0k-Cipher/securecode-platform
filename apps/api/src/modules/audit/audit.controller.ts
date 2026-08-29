import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import {
  AuthGuard,
} from '@nestjs/passport';

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
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 100,
  })
  async list(
    @Query('limit')
    limit?: string,
  ) {
    const parsedLimit =
      Number(
        limit ?? 500,
      );

    return {
      data:
        await this.auditService
          .getPlatformLogs({
            take:
              Number.isFinite(
                parsedLimit,
              )
                ? parsedLimit
                : 500,
          }),
    };
  }
}
