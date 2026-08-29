import {
  Module,
} from '@nestjs/common';

import {
  BullModule,
} from '@nestjs/bullmq';

import {
  RbacModule,
} from '../rbac/rbac.module';

import {
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';

import {
  ScansController,
} from './scans.controller';

import {
  ScansService,
} from './scans.service';

@Module({
  imports: [
    RbacModule,
    BullModule.registerQueue({
      name:
        QUEUE_NAMES.SECURITY_SCAN,
    }),
  ],

  controllers: [
    ScansController,
  ],

  providers: [
    ScansService,
  ],

  exports: [
    ScansService,
  ],
})
export class ScansModule {}
