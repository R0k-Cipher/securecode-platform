import { Module } from '@nestjs/common';

import { PrismaModule } from '@securecode-platform/database';
import { RbacModule } from '../rbac/rbac.module';

import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
  ],
  controllers: [
    RepositoriesController,
  ],
  providers: [
    RepositoriesService,
  ],
  exports: [
    RepositoriesService,
  ],
})
export class RepositoriesModule {}
