import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { QueueTestController } from './queue-test.controller';

import { QUEUE_NAMES } from '@securecode-platform/queue-contracts';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow<string>('redis.host'),
          port: configService.getOrThrow<number>('redis.port'),
          password:
            configService.get<string>('redis.password') ||
            undefined,
          db: configService.get<number>('redis.database') ?? 0,
        },

        defaultJobOptions: {
          attempts: 3,

          backoff: {
            type: 'exponential',
            delay: 5_000,
          },

          removeOnComplete: {
            age: 24 * 60 * 60,
            count: 1_000,
          },

          removeOnFail: {
            age: 7 * 24 * 60 * 60,
            count: 5_000,
          },
        },
      }),
    }),

    BullModule.registerQueue(
      {
        name: QUEUE_NAMES.REPOSITORY_SYNC,
      },
      {
        name: QUEUE_NAMES.SECURITY_SCAN,
      },
      {
        name: QUEUE_NAMES.REPORT_GENERATION,
      },
      {
        name: QUEUE_NAMES.NOTIFICATIONS,
      },
    ),
  ],

  controllers: [QueueTestController],
  exports: [BullModule],
})
export class QueuesModule {}
