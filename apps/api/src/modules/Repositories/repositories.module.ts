import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { PrismaModule } from '@securecode-platform/database';
import { QUEUE_NAMES } from '@securecode-platform/queue-contracts';

import { RbacModule } from '../rbac/rbac.module';
import { GithubAppModule } from '../github-app/github-app.module';

import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';
import { RepositorySyncDispatcherService } from './repository-sync-dispatcher.service';

@Module({
  imports: [
    PrismaModule,
    RbacModule,
    GithubAppModule,
    BullModule.registerQueue({
      name: QUEUE_NAMES.REPOSITORY_SYNC,
    }),
  ],
  controllers: [RepositoriesController],
  providers: [
    RepositoriesService,
    RepositorySyncDispatcherService,
  ],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
