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

@Module({
  imports: [
    RbacModule,
  ],

  controllers: [
    FindingsController,
  ],

  providers: [
    FindingsService,
  ],

  exports: [
    FindingsService,
  ],
})
export class FindingsModule {}
