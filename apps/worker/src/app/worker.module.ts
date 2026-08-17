import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
  appConfiguration,
  environmentValidationSchema,
} from '@securecode-platform/configuration';

import {
  PrismaModule,
} from '@securecode-platform/database';

import {
  WorkerQueuesModule,
} from './queues/worker-queues.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [appConfiguration],
      validationSchema: environmentValidationSchema,
      validationOptions: {
        abortEarly: false,
        allowUnknown: true,
      },
    }),

    PrismaModule,
    WorkerQueuesModule,
  ],
})
export class WorkerModule {}
