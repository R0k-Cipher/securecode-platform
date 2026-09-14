import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiTags,
} from '@nestjs/swagger';

import {
  IsEnum,
} from 'class-validator';

import {
  PlatformRole,
  UserStatus,
} from '@prisma/client';

import {
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard';

import {
  PlatformAdminGuard,
} from '../auth/guards/platform-admin.guard';

import {
  PlatformAdminService,
} from './platform-admin.service';

class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

class UpdatePlatformRoleDto {
  @IsEnum(PlatformRole)
  platformRole!: PlatformRole;
}

@ApiTags('Platform Admin')
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  PlatformAdminGuard,
)
@Controller('platform-admin')
export class PlatformAdminController {
  constructor(
    private readonly service:
      PlatformAdminService,
  ) {}

  @Get('dashboard')
  dashboard() {
    return this.service
      .dashboard();
  }

  @Get('users')
  users() {
    return this.service
      .listUsers();
  }

  @Get('organizations')
  organizations() {
    return this.service
      .listOrganizations();
  }

  @Get('projects')
  projects() {
    return this.service
      .listProjects();
  }

  @Get('scans')
  scans() {
    return this.service
      .listScans();
  }

  @Get('audit-logs')
  auditLogs() {
    return this.service
      .listAuditLogs();
  }

  @Get('system')
  system() {
    return this.service
      .systemStatus();
  }

  @Patch(
    'users/:id/status',
  )
  status(
    @Param(
      'id',
      new ParseUUIDPipe(),
    )
    id: string,

    @Body()
    dto: UpdateUserStatusDto,
  ) {
    return this.service
      .setUserStatus(
        id,
        dto.status,
      );
  }

  @Patch(
    'users/:id/role',
  )
  role(
    @Param(
      'id',
      new ParseUUIDPipe(),
    )
    id: string,

    @Body()
    dto: UpdatePlatformRoleDto,
  ) {
    return this.service
      .setUserRole(
        id,
        dto.platformRole,
      );
  }
}
