import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { AuthGuard } from '@nestjs/passport';

import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PlatformAdminGuard } from '../auth/guards/platform-admin.guard';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator';
import { PermissionsGuard } from '../rbac/guards/permissions.guard';
import { PERMISSION_CODES } from '../rbac/types/permission-code.type';

import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { OrganizationQueryDto } from './dto/organization-query.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('Organizations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Post()
  @UseGuards(PlatformAdminGuard)
  @ApiOperation({ summary: 'Créer une organisation' })
  @ApiCreatedResponse({ description: 'Organisation créée avec succès' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizationsService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister mes organisations' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrganizationQueryDto,
  ) {
    return this.organizationsService.findAllForUser(user.id, query);
  }

  @Get(':organizationId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.ORGANIZATION_READ)
  @ApiOperation({ summary: 'Détails d’une organisation' })
  @ApiParam({ name: 'organizationId' })
  @ApiOkResponse({ description: 'Organisation trouvée' })
  findOne(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.findOne(organizationId, user.id);
  }

  @Patch(':organizationId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.ORGANIZATION_UPDATE)
  @ApiOperation({ summary: 'Modifier une organisation' })
  update(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(organizationId, user.id, dto);
  }

  @Delete(':organizationId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.ORGANIZATION_DELETE)
  @ApiOperation({ summary: 'Supprimer une organisation' })
  remove(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.remove(organizationId, user.id);
  }

  @Get(':organizationId/members')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.MEMBER_READ)
  @ApiOperation({ summary: 'Liste des membres' })
  getMembers(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.getMembers(organizationId, user.id);
  }

  @Post(':organizationId/members/invite')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.MEMBER_INVITE)
  @ApiOperation({ summary: 'Inviter un membre avec ses affectations projet' })
  inviteMember(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizationsService.inviteMember(
      organizationId,
      user.id,
      dto,
    );
  }

  @Patch(':organizationId/members/:memberId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.MEMBER_UPDATE)
  @ApiOperation({ summary: "Modifier le rôle d'un membre" })
  updateMemberRole(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizationsService.updateMemberRole(
      organizationId,
      memberId,
      user.id,
      dto,
    );
  }

  @Delete(':organizationId/members/:memberId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.MEMBER_DELETE)
  @ApiOperation({ summary: "Retirer un membre de l'organisation" })
  removeMember(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.removeMember(
      organizationId,
      memberId,
      user.id,
    );
  }

  @Delete(':organizationId/leave')
  @ApiOperation({ summary: 'Quitter une organisation' })
  leaveOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.leaveOrganization(
      organizationId,
      user.id,
    );
  }

  @Get(':organizationId/invitations')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.INVITATION_READ)
  @ApiOperation({ summary: 'Lister les invitations' })
  getInvitations(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.getInvitations(
      organizationId,
      user.id,
    );
  }

  @Delete(':organizationId/invitations/:invitationId')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.INVITATION_CANCEL)
  @ApiOperation({ summary: 'Annuler une invitation' })
  cancelInvitation(
    @Param('organizationId') organizationId: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.cancelInvitation(
      organizationId,
      invitationId,
      user.id,
    );
  }

  // Route historique conservée pour ne pas casser le frontend existant.
  @Post('invitations/accept')
  @ApiOperation({ summary: 'Accepter une invitation (session existante)' })
  acceptInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AcceptInvitationDto,
  ) {
    return this.organizationsService.acceptInvitation(user.id, dto);
  }

  @Get(':organizationId/roles')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.MEMBER_INVITE)
  @ApiOperation({ summary: 'Lister les rôles organisation assignables' })
  getAssignableRoles(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.getAssignableRoles(
      organizationId,
      user.id,
    );
  }

  @Get(':organizationId/project-roles')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(PERMISSION_CODES.MEMBER_INVITE)
  @ApiOperation({ summary: 'Lister les rôles projet assignables' })
  getAssignableProjectRoles(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.organizationsService.getAssignableProjectRoles(
      organizationId,
      user.id,
    );
  }
}
