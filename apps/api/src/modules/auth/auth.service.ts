
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@securecode-platform/database';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

import type {
  PlatformRole,
} from '@prisma/client';


interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}

interface SafeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  status: string;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  platformRole: PlatformRole;
  createdAt: Date;
  updatedAt: Date;

}

@Injectable()
export class AuthService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtlSeconds: number;
  private readonly refreshTtlSeconds: number;

  private readonly safeUserSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
    status: true,
    emailVerifiedAt: true,
    lastLoginAt: true,
    platformRole: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret = this.requiredConfig('JWT_ACCESS_SECRET');
    this.refreshSecret = this.requiredConfig('JWT_REFRESH_SECRET');

    this.accessTtlSeconds = this.numberConfig(
      'JWT_ACCESS_TTL_SECONDS',
      900,
    );

    this.refreshTtlSeconds = this.numberConfig(
      'JWT_REFRESH_TTL_SECONDS',
      2_592_000,
    );
  }

  async register(
    dto: RegisterDto,
    metadata: RequestMetadata = {},
  ): Promise<
    {
      user: SafeUser;

      organization: {
        id: string;
        name: string;
        slug: string;
      };
    } &
      AuthTokens
  > {
    const email =
      dto.email
        .trim()
        .toLowerCase();

    const existingUser =
      await this.prisma
        .user
        .findUnique({
          where: {
            email,
          },

          select: {
            id:
              true,
          },
        });

    if (existingUser) {
      throw new ConflictException(
        'Un compte utilise déjà cette adresse email.',
      );
    }

    const passwordHash =
      await this.hashValue(
        dto.password,
      );

    const result =
      await this.prisma
        .$transaction(
          async (
            transaction,
          ) => {
            const ownerRole =
              await transaction
                .role
                .findUnique({
                  where: {
                    code:
                      'OWNER',
                  },

                  select: {
                    id:
                      true,
                  },
                });

            if (!ownerRole) {
              throw new ConflictException(
                'Le rôle système OWNER est introuvable.',
              );
            }

            const user =
              await transaction
                .user
                .create({
                  data: {
                    email,

                    passwordHash,

                    firstName:
                      dto.firstName
                        .trim(),

                    lastName:
                      dto.lastName
                        .trim(),

                    status:
                      'ACTIVE',

                    platformRole:
                      'USER',
                  },

                  select:
                    this.safeUserSelect,
                });

            const baseSlug =
              this.slugify(
                dto.organizationName,
              );

            let slug =
              baseSlug;

            let suffix =
              1;

            while (
              await transaction
                .organization
                .findUnique({
                  where: {
                    slug,
                  },

                  select: {
                    id:
                      true,
                  },
                })
            ) {
              suffix +=
                1;

              slug =
                `${baseSlug}-${suffix}`;
            }

            const organization =
              await transaction
                .organization
                .create({
                  data: {
                    name:
                      dto.organizationName
                        .trim(),

                    slug,

                    description:
                      dto.organizationDescription
                        ?.trim() ||
                      null,

                    createdById:
                      user.id,
                  },

                  select: {
                    id:
                      true,

                    name:
                      true,

                    slug:
                      true,
                  },
                });

            await transaction
              .organizationMember
              .create({
                data: {
                  organizationId:
                    organization.id,

                  userId:
                    user.id,

                  roleId:
                    ownerRole.id,

                  joinedAt:
                    new Date(),
                },
              });

            return {
              user,
              organization,
            };
          },
        );

    const tokens =
      await this
        .createSessionAndTokens(
          result.user.id,
          result.user.email,
          result.user.platformRole,
          metadata,
        );

    return {
      user:
        result.user,

      organization:
        result.organization,

      ...tokens,
    };
  }

  async login(
    dto: LoginDto,
    metadata: RequestMetadata = {},
  ): Promise<{ user: SafeUser } & AuthTokens> {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        ...this.safeUserSelect,
        passwordHash: true,
      },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException(
        'Email ou mot de passe incorrect.',
      );
    }

    const passwordIsValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException(
        'Email ou mot de passe incorrect.',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Ce compte utilisateur n’est pas actif.',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.createSessionAndTokens(
      user.id,
      user.email,
      user.platformRole,
      metadata,
    );

    const { passwordHash: _passwordHash, ...safeUser } = user;

    return {
      user: safeUser,
      ...tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    if (!refreshToken?.trim()) {
      throw new UnauthorizedException(
        'Le refresh token est obligatoire.',
      );
    }

    const payload = await this.verifyRefreshToken(refreshToken);

    if (!payload.sessionId) {
      throw new UnauthorizedException(
        'Refresh token invalide : session absente.',
      );
    }

    const session = await this.prisma.session.findUnique({
      where: {
        id: payload.sessionId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
            platformRole:true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException(
        'Session introuvable ou expirée.',
      );
    }

    if (session.userId !== payload.sub) {
      await this.revokeSession(session.id);

      throw new UnauthorizedException(
        'Refresh token invalide.',
      );
    }

    if (session.revokedAt) {
      throw new UnauthorizedException(
        'Cette session a été révoquée.',
      );
    }

    if (session.expiresAt <= new Date()) {
      await this.revokeSession(session.id);

      throw new UnauthorizedException(
        'Cette session a expiré.',
      );
    }

    if (session.user.status !== 'ACTIVE') {
      await this.revokeSession(session.id);

      throw new UnauthorizedException(
        'Le compte utilisateur n’est pas actif.',
      );
    }

    const tokenMatches = await this.verifyHash(
      session.refreshTokenHash,
      refreshToken,
    );

    if (!tokenMatches) {
      /*
       * Le refresh token fourni possède un sessionId valide,
       * mais ne correspond plus au hash enregistré.
       *
       * Cela peut indiquer la réutilisation d’un ancien refresh token
       * après une rotation. La session est donc révoquée.
       */
      await this.revokeSession(session.id);

      throw new UnauthorizedException(
        'Réutilisation de refresh token détectée. La session a été révoquée.',
      );
    }

    /*
     * Rotation :
     * on génère un nouveau couple access/refresh,
     * puis on remplace le hash du refresh token en base.
     */
    const tokens = await this.signTokens(
      session.user.id,
      session.user.email,
      session.id,
      session.user.platformRole,
    );

    const newRefreshTokenHash = await this.hashValue(
      tokens.refreshToken,
    );

    await this.prisma.session.update({
      where: {
        id: session.id,
      },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: this.createExpirationDate(
          this.refreshTtlSeconds,
        ),
      },
    });

    return tokens;
  }

  async logout(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    if (!sessionId) {
      throw new UnauthorizedException(
        'Identifiant de session absent.',
      );
    }

    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: this.safeUserSelect,
    });

    if (!user) {
      throw new UnauthorizedException(
        'Utilisateur introuvable.',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Le compte utilisateur n’est pas actif.',
      );
    }

    return user;
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        passwordHash: true,
        status: true,
      },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException(
        'Utilisateur introuvable.',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException(
        'Le compte utilisateur n’est pas actif.',
      );
    }

    const currentPasswordIsValid = await argon2.verify(
      user.passwordHash,
      dto.currentPassword,
    );

    if (!currentPasswordIsValid) {
      throw new UnauthorizedException(
        'Mot de passe actuel incorrect.',
      );
    }

    const samePassword = await argon2.verify(
      user.passwordHash,
      dto.newPassword,
    );

    if (samePassword) {
      throw new ConflictException(
        'Le nouveau mot de passe doit être différent de l’ancien.',
      );
    }

    const newPasswordHash = await this.hashValue(
      dto.newPassword,
    );

    const revokedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          passwordHash: newPasswordHash,
        },
      }),

      this.prisma.session.updateMany({
        where: {
          userId,
          revokedAt: null,
        },
        data: {
          revokedAt,
        },
      }),
    ]);
  }

  private async createSessionAndTokens(
    userId: string,
    email: string,
    platformRole: PlatformRole,
    metadata: RequestMetadata,
  ): Promise<AuthTokens> {
    const sessionId = randomUUID();

    const tokens = await this.signTokens(
      userId,
      email,
      sessionId,
      platformRole,
    );

    const refreshTokenHash = await this.hashValue(
      tokens.refreshToken,
    );

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash,
        ipAddress: metadata.ipAddress?.trim() || null,
        userAgent: metadata.userAgent?.trim() || null,
        expiresAt: this.createExpirationDate(
          this.refreshTtlSeconds,
        ),
      },
    });

    return tokens;
  }

  private async signTokens(
    userId: string,
    email: string,
    sessionId: string,
    platformRole: PlatformRole,

  ): Promise<AuthTokens> {
    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      sessionId,
      tokenType: 'access',
      platformRole,
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      sessionId,
      tokenType: 'refresh',
      platformRole,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
      }),

      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtlSeconds,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshTokenExpiresIn: this.refreshTtlSeconds,
    };
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<JwtPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<JwtPayload>(
          token,
          {
            secret: this.refreshSecret,
          },
        );

      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException(
          'Le token fourni n’est pas un refresh token.',
        );
      }

      if (!payload.sub || !payload.sessionId) {
        throw new UnauthorizedException(
          'Le refresh token ne contient pas les informations nécessaires.',
        );
      }

      return payload;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        'Refresh token invalide ou expiré.',
      );
    }
  }

  private async revokeSession(
    sessionId: string,
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private async hashValue(value: string): Promise<string> {
    return argon2.hash(value, {
      type: argon2.argon2id,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  private async verifyHash(
    hash: string,
    plainValue: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(hash, plainValue);
    } catch {
      return false;
    }
  }

  private createExpirationDate(
    ttlSeconds: number,
  ): Date {
    return new Date(Date.now() + ttlSeconds * 1000);
  }

  private slugify(
    value: string,
  ): string {
    return value
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        '',
      )
      .toLowerCase()
      .trim()
      .replace(
        /[^a-z0-9]+/g,
        '-',
      )
      .replace(
        /^-+|-+$/g,
        '',
      )
      .slice(
        0,
        80,
      ) || 'organization';
  }

  private requiredConfig(key: string): string {
    const value =
      this.configService.get<string>(key)?.trim();

    if (!value) {
      throw new Error(
        `${key} est obligatoire dans les variables d’environnement.`,
      );
    }

    return value;
  }

  private numberConfig(
    key: string,
    fallback: number,
  ): number {
    const rawValue =
      this.configService.get<string | number>(key);

    const value =
      rawValue === undefined ||
      rawValue === null ||
      rawValue === ''
        ? fallback
        : Number(rawValue);

    if (
      !Number.isInteger(value) ||
      value <= 0
    ) {
      throw new Error(
        `${key} doit être un nombre entier positif exprimé en secondes.`,
      );
    }

    return value;
  }
}
