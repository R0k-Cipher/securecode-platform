import { Module } from '@nestjs/common';

import { PrismaModule } from '@securecode-platform/database';

import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';

import { InvitationActionsController } from './invitation-actions.controller';
import { InvitationActionsService } from './invitation-actions.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    AuditModule,
  ],
  controllers: [
    OrganizationsController,
    InvitationActionsController,
  ],
  providers: [
    OrganizationsService,
    InvitationActionsService,
  ],
  exports: [
    OrganizationsService,
  ],
})
export class OrganizationsModule {}
