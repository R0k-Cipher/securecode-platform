import {
  Module,
} from '@nestjs/common';

import {
  FindingsController,
} from './findings.controller';

import {
  RbacModule,
} from '../rbac/rbac.module';

import {
  FindingsService,
} from './findings.service';

import {
  FindingAssignmentsController,
} from './finding-assignments.controller';

import {
  FindingAssignmentsService,
} from './finding-assignments.service';

@Module({
  imports: [
    RbacModule,
  ],

  controllers: [
    FindingsController,
    FindingAssignmentsController,
  ],

  providers: [
    FindingsService,
    FindingAssignmentsService,
  ],

  exports: [
    FindingsService,
    FindingAssignmentsService,
  ],
})
export class FindingsModule {}
