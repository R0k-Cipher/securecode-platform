import { Module } from '@nestjs/common';

import { PrismaModule } from '@securecode-platform/database';
import { PermissionsGuard } from './guards/permissions.guard';
import { RbacService } from './rbac.service';

@Module({
  imports: [PrismaModule],
  providers: [
    RbacService,
    PermissionsGuard,
  ],
  exports: [
    RbacService,
    PermissionsGuard,
  ],
})
export class RbacModule {}
