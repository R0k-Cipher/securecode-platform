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
  ScanSchedulesController,
} from './scan-schedules.controller';

import {
  ScansService,
} from './scans.service';

import {
  ScanSchedulesService,
} from './scan-schedules.service';

@Module({
  imports: [
    RbacModule,

    BullModule.registerQueue(
      {
        name:
          QUEUE_NAMES.SECURITY_SCAN,
      },
      {
        name:
          QUEUE_NAMES.SCAN_SCHEDULER,
      },
    ),
  ],

  controllers: [
    ScansController,
    ScanSchedulesController,
  ],

  providers: [
    ScansService,
    ScanSchedulesService,
  ],

  exports: [
    ScansService,
    ScanSchedulesService,
  ],
})
export class ScansModule {}
