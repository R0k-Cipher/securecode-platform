import {
  Module,
} from '@nestjs/common';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import {
  JwtModule,
  JwtModuleOptions,
} from '@nestjs/jwt';

import {
  PassportModule,
} from '@nestjs/passport';

import {
  RbacModule,
} from '../rbac/rbac.module';

import {
  AuthController,
} from './auth.controller';

import {
  AuthService,
} from './auth.service';

import {
  AuthContextService,
} from './auth-context.service';

import {
  JwtStrategy,
} from './strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,

    RbacModule,

    PassportModule.register({
      defaultStrategy:
        'jwt',

      session:
        false,
    }),

    JwtModule.registerAsync({
      imports: [
        ConfigModule,
      ],

      inject: [
        ConfigService,
      ],

      useFactory: (
        configService:
          ConfigService,
      ): JwtModuleOptions => {
        const accessTokenExpiresIn =
          configService.get<number>(
            'JWT_ACCESS_TTL_SECONDS',
            900,
          );

        return {
          secret:
            configService
              .getOrThrow<string>(
                'JWT_ACCESS_SECRET',
              ),

          signOptions: {
            expiresIn:
              accessTokenExpiresIn,
          },
        };
      },
    }),
  ],

  controllers: [
    AuthController,
  ],

  providers: [
    AuthService,
    AuthContextService,
    JwtStrategy,
  ],

  exports: [
    AuthService,
    AuthContextService,
    JwtModule,
  ],
})
export class AuthModule {}
