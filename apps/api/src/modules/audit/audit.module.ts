import {
  Module,
} from '@nestjs/common';

import {
  APP_INTERCEPTOR,
} from '@nestjs/core';

import {
  AuditController,
} from './audit.controller';

import {
  AuditService,
} from './audit.service';

import {
  AuditIpInterceptor,
} from './audit-ip.interceptor';

@Module({
  controllers: [
    AuditController,
  ],

  providers: [
    AuditService,

    {
      provide:
        APP_INTERCEPTOR,

      useClass:
        AuditIpInterceptor,
    },
  ],

  exports: [
    AuditService,
  ],
})
export class AuditModule {}
