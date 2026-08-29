import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import {
  AuthGuard,
} from '@nestjs/passport';

import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  RequirePermissions,
} from '../rbac/decorators/require-permissions.decorator';

import {
  PermissionsGuard,
} from '../rbac/guards/permissions.guard';

import {
  PERMISSION_CODES,
} from '../rbac/types/permission-code.type';

import {
  SecurityDashboardService,
} from './security-dashboard.service';

@ApiTags('Security Dashboard')
@ApiBearerAuth()
@UseGuards(
  AuthGuard('jwt'),
  PermissionsGuard,
)
@Controller(
  'organizations/:organizationId/projects/:projectId/security-dashboard',
)
export class SecurityDashboardController {
  constructor(
    private readonly securityDashboardService:
      SecurityDashboardService,
  ) {}

  @Get()
  @RequirePermissions(
    PERMISSION_CODES.PROJECT_READ,
  )
  @ApiOperation({
    summary:
      'Afficher le tableau de bord sécurité du projet',
  })
  @ApiOkResponse({
    description:
      'Synthèse sécurité du projet.',
  })
  getDashboard(
    @Param(
      'organizationId',
      new ParseUUIDPipe(),
    )
    organizationId: string,

    @Param(
      'projectId',
      new ParseUUIDPipe(),
    )
    projectId: string,
  ) {
    return this.securityDashboardService.getProjectDashboard(
      organizationId,
      projectId,
    );
  }
}
