import { Module } from '@nestjs/common';

import { PrismaModule } from '@securecode-platform/database';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

import {
  OrganizationAuditController,
} from './organization-audit.controller';

import {
  AuditModule,
} from '../audit/audit.module';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [
    OrganizationsController,
    OrganizationAuditController,
  ],
  providers: [
    OrganizationsService,
  ],
  exports: [
    OrganizationsService,
  ],
})
export class OrganizationsModule {}
