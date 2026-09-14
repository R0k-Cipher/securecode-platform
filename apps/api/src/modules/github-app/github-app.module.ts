import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { GithubAppController } from './github-app.controller';
import { GithubAppService } from './github-app.service';
import { GithubClientService } from './github-client.service';

import { RbacModule } from '../rbac/rbac.module';


import {
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';


import {
  GithubWebhookController,
} from './github-webhook.controller';

import {
  GithubWebhookService,
} from './github-webhook.service';

import {
  GithubWebhookSignatureService,
} from './github-webhook-signature.service';

import {
  GithubWebhookDeduplicationService,
} from './github-webhook-deduplication.service';

@Module({
  imports: [
    RbacModule,

    BullModule.registerQueue({
      name: QUEUE_NAMES.REPOSITORY_SYNC,
    },{
      name: QUEUE_NAMES.SECURITY_SCAN,
    }
  ),
  ],

  controllers: [
    GithubAppController,
    GithubWebhookController,
  ],

  providers: [
    GithubAppService,
    GithubClientService,

    GithubWebhookService,
    GithubWebhookSignatureService,
    GithubWebhookDeduplicationService,
  ],

  exports: [
    GithubAppService,
    GithubClientService,
  ],
})
export class GithubAppModule {}
