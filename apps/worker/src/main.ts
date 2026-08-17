import 'reflect-metadata';

import {
  ConsoleLogger,
} from '@nestjs/common';

import {
  NestFactory,
} from '@nestjs/core';

import {
  WorkerModule,
} from './app/worker.module';

async function bootstrap(): Promise<void> {
  const app =
    await NestFactory.createApplicationContext(
      WorkerModule,
      {
        logger: new ConsoleLogger({
          json:
            process.env['NODE_ENV'] ===
            'production',

          timestamp: true,
        }),
      },
    );

  app.enableShutdownHooks();

  const logger = new ConsoleLogger('WorkerBootstrap');

  logger.log('Worker SecureCode-AI démarré');
  logger.log('En attente des jobs BullMQ');
}

bootstrap().catch((error: unknown) => {
  const logger =
    new ConsoleLogger('WorkerBootstrap');

  logger.error(
    'Le démarrage du worker a échoué',
    error instanceof Error
      ? error.stack
      : String(error),
  );

  process.exit(1);
});
