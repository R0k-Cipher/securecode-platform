import { Module } from '@nestjs/common';

import { PrismaModule } from '@securecode-platform/database';
import { RbacModule } from '../rbac/rbac.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
  ],
  controllers: [
    OrganizationsController,
  ],
  providers: [
    OrganizationsService,
  ],
  exports: [
    OrganizationsService,
  ],
})
export class OrganizationsModule {}
