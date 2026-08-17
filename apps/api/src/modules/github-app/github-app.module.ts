import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { GithubAppController } from './github-app.controller';
import { GithubAppService } from './github-app.service';
import { GithubClientService } from './github-client.service';

import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [
    RbacModule,

    BullModule.registerQueue({
      name: 'repository-sync',
    }),
  ],

  controllers: [
    GithubAppController,
  ],

  providers: [
    GithubAppService,
    GithubClientService,
  ],

  exports: [
    GithubAppService,
    GithubClientService,
  ],
})
export class GithubAppModule {}