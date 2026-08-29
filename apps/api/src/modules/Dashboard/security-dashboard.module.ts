import { Module } from '@nestjs/common';

import { SecurityDashboardController } from './security-dashboard.controller';
import { SecurityDashboardService } from './security-dashboard.service';

import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    RbacModule,
  ],
  controllers: [
    SecurityDashboardController,
  ],
  providers: [
    SecurityDashboardService,
  ],
  exports: [
    SecurityDashboardService,
  ],
})
export class SecurityDashboardModule {}