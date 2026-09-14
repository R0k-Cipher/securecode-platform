import {
  Module,
} from '@nestjs/common';

import {
  NotificationsModule,
} from '../notifications/notifications.module';

import {
  RbacModule,
} from '../rbac/rbac.module';

import {
  ReportsController,
} from './reports.controller';

import {
  OrganizationReportsController,
} from './organization-reports.controller';

import {
  ReportsService,
} from './reports.service';

@Module({
  imports: [
    NotificationsModule,
    RbacModule,
  ],

  controllers: [
    ReportsController,
    OrganizationReportsController,
  ],

  providers: [
    ReportsService,
  ],

  exports: [
    ReportsService,
  ],
})
export class ReportsModule {}
