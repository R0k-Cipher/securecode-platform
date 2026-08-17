import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
} from 'passport-jwt';

import { PrismaService } from '@securecode-platform/database';

import type { JwtPayload } from '../interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  'jwt',
) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.getOrThrow<string>(
          'JWT_ACCESS_SECRET',
        ),
    });
  }

  async validate(payload: JwtPayload) {
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException(
        'Ce token ne peut pas être utilisé comme access token.',
      );
    }

    if (!payload.sub || !payload.sessionId) {
      throw new UnauthorizedException(
        'Token incomplet ou invalide.',
      );
    }

    const session =
      await this.prisma.session.findFirst({
        where: {
          id: payload.sessionId,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              status: true,
              emailVerifiedAt: true,
            },
          },
        },
      });

    if (!session) {
      throw new UnauthorizedException(
        'Session inexistante, révoquée ou expirée.',
      );
    }

    if (session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Le compte utilisateur n’est pas actif.',
      );
    }

    return {
      ...session.user,
      sessionId: session.id,
    };
  }
}
