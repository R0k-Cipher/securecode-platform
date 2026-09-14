import {
  Module,
} from '@nestjs/common';

import {
  APP_INTERCEPTOR,
} from '@nestjs/core';

import {
  RbacModule,
} from '../rbac';

import {
  AuditIpInterceptor,
} from './audit-ip.interceptor';

import {
  AuditService,
} from './audit.service';

import {
  CustomerAuditController,
} from './customer-audit.controller';

@Module({
  imports: [
    RbacModule,
  ],

  controllers: [
    
    CustomerAuditController,
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