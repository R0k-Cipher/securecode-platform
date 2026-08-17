import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../modules/auth/auth.module';
import { UsersModule } from '../modules/users/users.module';
import { OrganizationsModule } from '../modules/organizations/organizations.module';
import { ProjectsModule } from '../modules/projects/projects.module';
import { RepositoriesModule } from '../modules/Repositories/repositories.module';
import { GitConnectionsModule } from '../modules/git-connections/git-connections.module';
import { GithubAppModule } from '../modules/github-app/github-app.module';

import {
  appConfiguration,
  environmentValidationSchema,
} from '@securecode-platform/configuration';

import {
  PrismaModule,
} from '@securecode-platform/database';

import {
  QueuesModule,
} from './queues/queues.module';

import {
  HealthModule,
} from './health/health.module';

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

    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),

    PrismaModule,
    QueuesModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    RepositoriesModule,
    GitConnectionsModule,
    GithubAppModule,
  ],
})
export class AppModule {}
