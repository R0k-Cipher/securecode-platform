import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

import {
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';

import {
  RepositorySyncProcessor,
} from '../processors/repository-sync.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        connection: {
          host:
            configService.getOrThrow<string>('redis.host'),

          port:
            configService.getOrThrow<number>('redis.port'),

          password:
            configService.get<string>('redis.password') ||
            undefined,

          db:
            configService.get<number>('redis.database') ?? 0,
        },
      }),
    }),

    BullModule.registerQueue({
      name: QUEUE_NAMES.REPOSITORY_SYNC,
    }),
  ],

  providers: [
    RepositorySyncProcessor,
  ],
})
export class WorkerQueuesModule {}
