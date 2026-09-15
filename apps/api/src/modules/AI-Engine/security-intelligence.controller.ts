import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { PERMISSION_CODES } from '../rbac/types/permission-code.type';
import { SecurityIntelligenceService } from './security-intelligence.service';

@ApiTags('Security Intelligence')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@Controller(
  'organizations/:organizationId/projects/:projectId/security-intelligence',
)
export class SecurityIntelligenceController {
  constructor(private readonly intelligence: SecurityIntelligenceService) {}

  @Get()
  @RequirePermissions(PERMISSION_CODES.FINDING_READ)
  @ApiOperation({
    summary: 'Afficher les risques contextuels et chemins d’attaque du projet',
  })
  overview(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.intelligence.overview(organizationId, projectId);
  }

  @Get('findings/:findingId')
  @RequirePermissions(PERMISSION_CODES.FINDING_READ)
  @ApiOperation({ summary: 'Afficher l’évaluation contextuelle d’un finding' })
  findingRisk(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('findingId', ParseUUIDPipe) findingId: string,
  ) {
    return this.intelligence.findingRisk(organizationId, projectId, findingId);
  }
}
