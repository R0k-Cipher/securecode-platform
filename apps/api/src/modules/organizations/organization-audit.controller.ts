import {
  Controller,
  Get,
  Param,
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
  AuditService,
} from '../audit/audit.service';

import {
  OrganizationsService,
} from './organizations.service';

@ApiTags(
  'Organization Audit',
)
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
)
@Controller(
  'organizations/:organizationId/audit-logs',
)
export class OrganizationAuditController {
  constructor(
    private readonly audit:
      AuditService,

    private readonly organizations:
      OrganizationsService,
  ) {}

  @Get()
  async list(
    @Param(
      'organizationId',
    )
    organizationId:
      string,

    @CurrentUser()
    user:
      AuthenticatedUser,
  ) {
    await this.organizations
      .requireManagementAccess(
        organizationId,
        user.id,
      );

    return {
      data:
        await this.audit
          .getOrganizationLogs(
            organizationId,
          ),
    };
  }
}
