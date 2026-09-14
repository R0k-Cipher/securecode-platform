import 'reflect-metadata';

import {
  ConsoleLogger,
  ValidationPipe,
} from '@nestjs/common';

import { ConfigService } from '@nestjs/config';

import { NestFactory } from '@nestjs/core';


import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import compression = require('compression');
import cookieParser = require('cookie-parser');
import helmet from 'helmet';


import { AppModule } from './app/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(
    AppModule,
     {
      rawBody: true,
      logger: new ConsoleLogger({
        json: process.env['NODE_ENV'] === 'production',
        timestamp: true,
    }),
  });

  const expressApp =
    app.getHttpAdapter()
      .getInstance();

  expressApp.set(
    'trust proxy',
    1,
  );

  const configService = app.get(ConfigService);

  const port =
    configService.getOrThrow<number>('app.port');

  const frontendUrl =
    configService.getOrThrow<string>('app.frontendUrl');

  app.setGlobalPrefix('api');

  app.use(helmet());

  app.use(
    compression({
      threshold: 1_024,
    }),
  );

  app.use(cookieParser());

  app.enableCors({
    origin: [frontendUrl],
    credentials: true,
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-Id',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableShutdownHooks();

  const swaggerConfiguration =
    new DocumentBuilder()
      .setTitle('SecureCode-AI API')
      .setDescription(
        'API de gestion et d’analyse de sécurité SecureCode-AI',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

  const swaggerDocument =
    SwaggerModule.createDocument(
      app,
      swaggerConfiguration,
    );

  SwaggerModule.setup(
    'api/docs',
    app,
    swaggerDocument,
    {
      swaggerOptions: {
        persistAuthorization: true,
      },
    },
  );

  await app.listen(port, '0.0.0.0');

  const logger = new ConsoleLogger('Bootstrap');

  logger.log(
    `API disponible sur http://localhost:${port}/api`,
  );

  logger.log(
    `Swagger disponible sur http://localhost:${port}/api/docs`,
  );
}

bootstrap().catch((error: unknown) => {
  const logger = new ConsoleLogger('Bootstrap');

  logger.error(
    'Le démarrage de l’API a échoué',
    error instanceof Error ? error.stack : String(error),
  );

  process.exit(1);
});
