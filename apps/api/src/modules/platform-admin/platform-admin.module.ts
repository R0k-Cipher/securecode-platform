import {
  Module,
} from '@nestjs/common';

import {
  PlatformAdminController,
} from './platform-admin.controller';

import {
  PlatformAdminService,
} from './platform-admin.service';

import { AuditModule } from '../audit/audit.module';

@Module({
  
  imports: [
    AuditModule,
  ],

  controllers: [
    PlatformAdminController,
  ],

  providers: [
    PlatformAdminService,
  ],
})
export class PlatformAdminModule {}
