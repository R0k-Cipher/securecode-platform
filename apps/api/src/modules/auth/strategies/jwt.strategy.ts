import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  PassportStrategy,
} from '@nestjs/passport';

import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt';

import {
  PrismaService,
} from '@securecode-platform/database';

import type {
  JwtPayload,
  AuthenticatedUser,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  'jwt',
) {
  constructor(
    private readonly prisma:
      PrismaService,

    configService:
      ConfigService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration:
        false,

      secretOrKey:
        configService.getOrThrow<string>(
          'JWT_ACCESS_SECRET',
        ),
    });
  }

  async validate(
    payload:
      JwtPayload,
  ): Promise<AuthenticatedUser> {
    if (
      payload.tokenType !==
      'access'
    ) {
      throw new UnauthorizedException(
        'Ce token ne peut pas être utilisé comme access token.',
      );
    }

    if (
      !payload.sub ||
      !payload.sessionId
    ) {
      throw new UnauthorizedException(
        'Token incomplet ou invalide.',
      );
    }

    const session =
      await this.prisma.session.findUnique({
        where: {
          id:
            payload.sessionId,
        },

        include: {
          user: {
            select: {
              id:
                true,

              email:
                true,

              firstName:
                true,

              lastName:
                true,

              avatarUrl:
                true,

              status:
                true,

              emailVerifiedAt:
                true,

              platformRole:
                true,
            },
          },

          organizationIdentity: {
            select: {
              id:
                true,

              organizationId:
                true,

              login:
                true,

              status:
                true,
            },
          },
        },
      });

    if (
      !session ||
      session.userId !==
        payload.sub
    ) {
      throw new UnauthorizedException(
        'Session inexistante ou invalide.',
      );
    }

    if (
      session.revokedAt
    ) {
      throw new UnauthorizedException(
        'Cette session a été révoquée.',
      );
    }

    if (
      session.expiresAt <=
      new Date()
    ) {
      throw new UnauthorizedException(
        'Cette session a expiré.',
      );
    }

    if (
      session.user.status !==
      'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Le compte utilisateur n’est pas actif.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Vérification du rôle plateforme
    |--------------------------------------------------------------------------
    |
    | On ne fait jamais confiance uniquement au JWT.
    */

    if (
      payload.platformRole !==
      session.user.platformRole
    ) {
      throw new UnauthorizedException(
        'Le rôle plateforme du token est invalide.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Platform Admin
    |--------------------------------------------------------------------------
    */

    if (
      session.user.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      if (
        session.organizationId !==
          null ||
        session.organizationIdentityId !==
          null ||
        payload.organizationId !==
          null ||
        payload.organizationIdentityId !==
          null ||
        payload.login !==
          null
      ) {
        throw new UnauthorizedException(
          'Contexte Platform Admin invalide.',
        );
      }

      return {
        ...session.user,

        sessionId:
          session.id,

        platformRole:
          session.user.platformRole,

        organizationIdentityId:
          null,

        organizationId:
          null,

        login:
          null,
      };
    }

    /*
    |--------------------------------------------------------------------------
    | Session client
    |--------------------------------------------------------------------------
    */

    if (
      !session.organizationId ||
      !session.organizationIdentityId ||
      !session.organizationIdentity
    ) {
      throw new UnauthorizedException(
        'Contexte organisationnel de la session incomplet.',
      );
    }

    if (
      session.organizationIdentity.status !==
      'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Cette identité organisation n’est plus active.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Anti tenant-switch / token forgery
    |--------------------------------------------------------------------------
    */

    if (
      payload.organizationId !==
        session.organizationId ||
      payload.organizationIdentityId !==
        session.organizationIdentityId
    ) {
      throw new UnauthorizedException(
        'Le contexte organisationnel du token ne correspond pas à la session.',
      );
    }

    if (
      session.organizationIdentity.organizationId !==
      session.organizationId
    ) {
      throw new UnauthorizedException(
        'La session référence une identité appartenant à une autre organisation.',
      );
    }

    if (
      payload.login !==
      session.organizationIdentity.login
    ) {
      throw new UnauthorizedException(
        'Le login du token ne correspond pas à l’identité active.',
      );
    }

    return {
      ...session.user,

      sessionId:
        session.id,

      platformRole:
        session.user.platformRole,

      organizationIdentityId:
        session.organizationIdentityId,

      organizationId:
        session.organizationId,

      login:
        session.organizationIdentity.login,
    };
  }
}
