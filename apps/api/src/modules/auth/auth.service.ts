import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  JwtService,
} from '@nestjs/jwt';

import {
  PlatformRole,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

import * as argon2 from 'argon2';

import {
  randomUUID,
} from 'node:crypto';

import {
  ChangePasswordDto,
} from './dto/change-password.dto';

import {
  LoginDto,
} from './dto/login.dto';

import type {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';

interface RequestMetadata {
  ipAddress?: string;

  userAgent?: string;
}

interface AuthTokens {
  accessToken:
    string;

  refreshToken:
    string;

  accessTokenExpiresIn:
    number;

  refreshTokenExpiresIn:
    number;
}

interface SafeUser {
  id:
    string;

  email:
    string;

  firstName:
    string;

  lastName:
    string;

  avatarUrl:
    string | null;

  status:
    string;

  emailVerifiedAt:
    Date | null;

  lastLoginAt:
    Date | null;

  platformRole:
    PlatformRole;

  createdAt:
    Date;

  updatedAt:
    Date;
}

@Injectable()
export class AuthService {
  private readonly accessSecret:
    string;

  private readonly refreshSecret:
    string;

  private readonly accessTtlSeconds:
    number;

  private readonly refreshTtlSeconds:
    number;

  private readonly safeUserSelect = {
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

    lastLoginAt:
      true,

    platformRole:
      true,

    createdAt:
      true,

    updatedAt:
      true,
  } as const;

  constructor(
    private readonly prisma:
      PrismaService,

    private readonly jwtService:
      JwtService,

    private readonly configService:
      ConfigService,
  ) {
    this.accessSecret =
      this.requiredConfig(
        'JWT_ACCESS_SECRET',
      );

    this.refreshSecret =
      this.requiredConfig(
        'JWT_REFRESH_SECRET',
      );

    this.accessTtlSeconds =
      this.numberConfig(
        'JWT_ACCESS_TTL_SECONDS',
        900,
      );

    this.refreshTtlSeconds =
      this.numberConfig(
        'JWT_REFRESH_TTL_SECONDS',
        2_592_000,
      );
  }

  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  */

  async login(
    dto:
      LoginDto,

    metadata:
      RequestMetadata = {},
  ) {
    const identifier =
      dto.identifier
        .trim()
        .toLowerCase();

    /*
    |--------------------------------------------------------------------------
    | Platform Admin
    |--------------------------------------------------------------------------
    */

    const platformAdmin =
      await this.prisma.user.findFirst({
        where: {
          platformRole:
            'PLATFORM_ADMIN',

          email:
            identifier,
        },

        select: {
          ...this.safeUserSelect,

          passwordHash:
            true,
        },
      });

    if (platformAdmin) {
      if (
        !platformAdmin.passwordHash
      ) {
        throw new UnauthorizedException(
          'Identifiant ou mot de passe incorrect.',
        );
      }

      const valid =
        await this.verifyHash(
          platformAdmin.passwordHash,
          dto.password,
        );

      if (!valid) {
        throw new UnauthorizedException(
          'Identifiant ou mot de passe incorrect.',
        );
      }

      if (
        platformAdmin.status !==
        'ACTIVE'
      ) {
        throw new UnauthorizedException(
          'Ce compte n’est pas actif.',
        );
      }

      return this.loginPlatformAdmin(
        platformAdmin,
        metadata,
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Organization Identity
    |--------------------------------------------------------------------------
    */

    const identity =
      await this.prisma.organizationIdentity.findUnique({
        where: {
          login:
            identifier,
        },

        include: {
          user: {
            select: {
              ...this.safeUserSelect,
            },
          },

          organization: {
            select: {
              id:
                true,

              name:
                true,

              slug:
                true,
            },
          },
        },
      });

    if (
      !identity ||
      !identity.passwordHash
    ) {
      throw new UnauthorizedException(
        'Identifiant ou mot de passe incorrect.',
      );
    }

    const passwordIsValid =
      await this.verifyHash(
        identity.passwordHash,
        dto.password,
      );

    if (
      !passwordIsValid
    ) {
      throw new UnauthorizedException(
        'Identifiant ou mot de passe incorrect.',
      );
    }

    if (
      identity.status !==
      'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Ce compte organisation n’est pas actif.',
      );
    }

    if (
      identity.user.status !==
      'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Le compte utilisateur est désactivé.',
      );
    }

    if (
      identity.user.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      throw new UnauthorizedException(
        'Un administrateur plateforme ne peut pas utiliser une identité cliente.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Vérifier membership organisation
    |--------------------------------------------------------------------------
    */

    const organizationMembership =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId:
              identity.organizationId,

            userId:
              identity.user.id,
          },
        },

        select: {
          id:
            true,

          role: {
            select: {
              scope:
                true,
            },
          },
        },
      });

    if (
      !organizationMembership ||
      organizationMembership.role.scope !==
        'ORGANIZATION'
    ) {
      throw new UnauthorizedException(
        'Votre accès à cette organisation n’est pas valide.',
      );
    }

    const now =
      new Date();

    await this.prisma.$transaction([
      this.prisma.organizationIdentity.update({
        where: {
          id:
            identity.id,
        },

        data: {
          lastLoginAt:
            now,
        },
      }),

      this.prisma.user.update({
        where: {
          id:
            identity.user.id,
        },

        data: {
          lastLoginAt:
            now,
        },
      }),
    ]);

    const tokens =
      await this.createSessionAndTokens(
        identity.user.id,
        identity.id,
        identity.organizationId,
        identity.login,
        identity.user.platformRole,
        metadata,
      );

    return {
      user:
        identity.user,

      identity: {
        id:
          identity.id,

        login:
          identity.login,

        mustChangePassword:
          identity.mustChangePassword,

        organization:
          identity.organization,
      },

      ...tokens,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | REFRESH
  |--------------------------------------------------------------------------
  */

  async refresh(
    refreshToken:
      string,
  ): Promise<AuthTokens> {
    if (
      !refreshToken?.trim()
    ) {
      throw new UnauthorizedException(
        'Le refresh token est obligatoire.',
      );
    }

    const payload =
      await this.verifyRefreshToken(
        refreshToken,
      );

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

              status:
                true,

              platformRole:
                true,
            },
          },

          organizationIdentity: {
            select: {
              id:
                true,

              login:
                true,

              organizationId:
                true,

              status:
                true,
            },
          },
        },
      });

    if (!session) {
      throw new UnauthorizedException(
        'Session introuvable ou expirée.',
      );
    }

    if (
      session.userId !==
      payload.sub
    ) {
      await this.revokeSession(
        session.id,
      );

      throw new UnauthorizedException(
        'Refresh token invalide.',
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
      await this.revokeSession(
        session.id,
      );

      throw new UnauthorizedException(
        'Cette session a expiré.',
      );
    }

    if (
      session.user.status !==
      'ACTIVE'
    ) {
      await this.revokeSession(
        session.id,
      );

      throw new UnauthorizedException(
        'Le compte utilisateur n’est pas actif.',
      );
    }

    if (
      session.user.platformRole !==
      payload.platformRole
    ) {
      await this.revokeSession(
        session.id,
      );

      throw new UnauthorizedException(
        'Le rôle plateforme du refresh token est invalide.',
      );
    }

    /*
    |--------------------------------------------------------------------------
    | Vérification contexte session / token
    |--------------------------------------------------------------------------
    */

    if (
      payload.organizationIdentityId !==
        session.organizationIdentityId ||
      payload.organizationId !==
        session.organizationId
    ) {
      await this.revokeSession(
        session.id,
      );

      throw new UnauthorizedException(
        'Le contexte organisationnel du token est invalide.',
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
        session.organizationIdentityId !==
          null ||
        session.organizationId !==
          null
      ) {
        await this.revokeSession(
          session.id,
        );

        throw new UnauthorizedException(
          'Session Platform Admin invalide.',
        );
      }
    } else {
      /*
      |--------------------------------------------------------------------------
      | Customer session
      |--------------------------------------------------------------------------
      */

      if (
        !session.organizationIdentity ||
        !session.organizationIdentityId ||
        !session.organizationId
      ) {
        await this.revokeSession(
          session.id,
        );

        throw new UnauthorizedException(
          'Session organisation invalide.',
        );
      }

      if (
        session.organizationIdentity.status !==
        'ACTIVE'
      ) {
        await this.revokeSession(
          session.id,
        );

        throw new UnauthorizedException(
          'Cette identité organisation n’est plus active.',
        );
      }

      if (
        session.organizationIdentity.organizationId !==
        session.organizationId
      ) {
        await this.revokeSession(
          session.id,
        );

        throw new UnauthorizedException(
          'Le tenant de cette session est invalide.',
        );
      }

      if (
        payload.login !==
        session.organizationIdentity.login
      ) {
        await this.revokeSession(
          session.id,
        );

        throw new UnauthorizedException(
          'Le login du refresh token est invalide.',
        );
      }
    }

    /*
    |--------------------------------------------------------------------------
    | Rotation refresh token
    |--------------------------------------------------------------------------
    */

    const tokenMatches =
      await this.verifyHash(
        session.refreshTokenHash,
        refreshToken,
      );

    if (!tokenMatches) {
      await this.revokeSession(
        session.id,
      );

      throw new UnauthorizedException(
        'Réutilisation de refresh token détectée. La session a été révoquée.',
      );
    }

    const tokens =
      await this.signTokens(
        session.user.id,

        session.organizationIdentityId,

        session.organizationId,

        session.organizationIdentity
          ?.login ??
          null,

        session.id,

        session.user.platformRole,
      );

    const newRefreshTokenHash =
      await this.hashValue(
        tokens.refreshToken,
      );

    await this.prisma.session.update({
      where: {
        id:
          session.id,
      },

      data: {
        refreshTokenHash:
          newRefreshTokenHash,

        expiresAt:
          this.createExpirationDate(
            this.refreshTtlSeconds,
          ),
      },
    });

    return tokens;
  }

  /*
  |--------------------------------------------------------------------------
  | LOGOUT
  |--------------------------------------------------------------------------
  */

  async logout(
    userId:
      string,

    sessionId:
      string,
  ): Promise<void> {
    if (!sessionId) {
      throw new UnauthorizedException(
        'Identifiant de session absent.',
      );
    }

    await this.prisma.session.updateMany({
      where: {
        id:
          sessionId,

        userId,

        revokedAt:
          null,
      },

      data: {
        revokedAt:
          new Date(),
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Logout all for current identity
  |--------------------------------------------------------------------------
  |
  | Important dans un SaaS multi-tenant :
  | un logout-all depuis entreprise A ne déconnecte pas entreprise B.
  */

  async logoutAll(
    user:
      AuthenticatedUser,
  ): Promise<void> {
    if (
      user.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      await this.prisma.session.updateMany({
        where: {
          userId:
            user.id,

          organizationIdentityId:
            null,

          organizationId:
            null,

          revokedAt:
            null,
        },

        data: {
          revokedAt:
            new Date(),
        },
      });

      return;
    }

    if (
      !user.organizationIdentityId ||
      !user.organizationId
    ) {
      throw new UnauthorizedException(
        'Contexte organisationnel absent.',
      );
    }

    await this.prisma.session.updateMany({
      where: {
        userId:
          user.id,

        organizationIdentityId:
          user.organizationIdentityId,

        organizationId:
          user.organizationId,

        revokedAt:
          null,
      },

      data: {
        revokedAt:
          new Date(),
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | ME
  |--------------------------------------------------------------------------
  */

  async me(
    authenticatedUser:
      AuthenticatedUser,
  ) {
    const user =
      await this.prisma.user.findUnique({
        where: {
          id:
            authenticatedUser.id,
        },

        select:
          this.safeUserSelect,
      });

    if (!user) {
      throw new UnauthorizedException(
        'Utilisateur introuvable.',
      );
    }

    if (
      user.status !==
      'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Le compte utilisateur n’est pas actif.',
      );
    }

    return {
      ...user,

      sessionId:
        authenticatedUser.sessionId,

      organizationIdentityId:
        authenticatedUser.organizationIdentityId,

      organizationId:
        authenticatedUser.organizationId,

      login:
        authenticatedUser.login,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | CHANGE PASSWORD
  |--------------------------------------------------------------------------
  */

  async changePassword(
    authenticatedUser:
      AuthenticatedUser,

    dto:
      ChangePasswordDto,
  ): Promise<void> {
    /*
    |--------------------------------------------------------------------------
    | Platform Admin password
    |--------------------------------------------------------------------------
    */

    if (
      authenticatedUser.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      const user =
        await this.prisma.user.findUnique({
          where: {
            id:
              authenticatedUser.id,
          },

          select: {
            id:
              true,

            passwordHash:
              true,

            status:
              true,

            platformRole:
              true,
          },
        });

      if (
        !user ||
        !user.passwordHash ||
        user.status !==
          'ACTIVE' ||
        user.platformRole !==
          'PLATFORM_ADMIN'
      ) {
        throw new UnauthorizedException(
          'Compte administrateur invalide.',
        );
      }

      const currentPasswordIsValid =
        await this.verifyHash(
          user.passwordHash,
          dto.currentPassword,
        );

      if (
        !currentPasswordIsValid
      ) {
        throw new UnauthorizedException(
          'Mot de passe actuel incorrect.',
        );
      }

      const samePassword =
        await this.verifyHash(
          user.passwordHash,
          dto.newPassword,
        );

      if (samePassword) {
        throw new ConflictException(
          'Le nouveau mot de passe doit être différent de l’ancien.',
        );
      }

      const newPasswordHash =
        await this.hashValue(
          dto.newPassword,
        );

      const revokedAt =
        new Date();

      await this.prisma.$transaction([
        this.prisma.user.update({
          where: {
            id:
              user.id,
          },

          data: {
            passwordHash:
              newPasswordHash,
          },
        }),

        this.prisma.session.updateMany({
          where: {
            userId:
              user.id,

            organizationIdentityId:
              null,

            organizationId:
              null,

            revokedAt:
              null,
          },

          data: {
            revokedAt,
          },
        }),
      ]);

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Organization Identity password
    |--------------------------------------------------------------------------
    */

    if (
      !authenticatedUser.organizationIdentityId ||
      !authenticatedUser.organizationId
    ) {
      throw new UnauthorizedException(
        'Contexte organisationnel absent.',
      );
    }

    const identity =
      await this.prisma.organizationIdentity.findFirst({
        where: {
          id:
            authenticatedUser.organizationIdentityId,

          organizationId:
            authenticatedUser.organizationId,

          userId:
            authenticatedUser.id,
        },

        select: {
          id:
            true,

          passwordHash:
            true,

          status:
            true,

          organizationId:
            true,
        },
      });

    if (
      !identity ||
      !identity.passwordHash
    ) {
      throw new UnauthorizedException(
        'Identité organisation introuvable.',
      );
    }

    if (
      identity.status !==
      'ACTIVE'
    ) {
      throw new UnauthorizedException(
        'Cette identité organisation n’est pas active.',
      );
    }

    const currentPasswordIsValid =
      await this.verifyHash(
        identity.passwordHash,
        dto.currentPassword,
      );

    if (
      !currentPasswordIsValid
    ) {
      throw new UnauthorizedException(
        'Mot de passe actuel incorrect.',
      );
    }

    const samePassword =
      await this.verifyHash(
        identity.passwordHash,
        dto.newPassword,
      );

    if (samePassword) {
      throw new ConflictException(
        'Le nouveau mot de passe doit être différent de l’ancien.',
      );
    }

    const newPasswordHash =
      await this.hashValue(
        dto.newPassword,
      );

    const revokedAt =
      new Date();

    await this.prisma.$transaction([
      this.prisma.organizationIdentity.update({
        where: {
          id:
            identity.id,
        },

        data: {
          passwordHash:
            newPasswordHash,

          mustChangePassword:
            false,

          temporaryPasswordExpiresAt:
            null,
        },
      }),

      /*
       * Révoque uniquement les sessions de cette identité.
       *
       * Si la même personne appartient à une autre entreprise,
       * ses autres sessions restent actives.
       */
      this.prisma.session.updateMany({
        where: {
          userId:
            authenticatedUser.id,

          organizationIdentityId:
            identity.id,

          organizationId:
            identity.organizationId,

          revokedAt:
            null,
        },

        data: {
          revokedAt,
        },
      }),
    ]);
  }

  /*
  |--------------------------------------------------------------------------
  | SESSION
  |--------------------------------------------------------------------------
  */

  private async createSessionAndTokens(
    userId:
      string,

    organizationIdentityId:
      string | null,

    organizationId:
      string | null,

    login:
      string | null,

    platformRole:
      PlatformRole,

    metadata:
      RequestMetadata,
  ): Promise<AuthTokens> {
    const sessionId =
      randomUUID();

    const tokens =
      await this.signTokens(
        userId,
        organizationIdentityId,
        organizationId,
        login,
        sessionId,
        platformRole,
      );

    const refreshTokenHash =
      await this.hashValue(
        tokens.refreshToken,
      );

    await this.prisma.session.create({
      data: {
        id:
          sessionId,

        userId,

        organizationIdentityId,

        organizationId,

        refreshTokenHash,

        ipAddress:
          metadata.ipAddress
            ?.trim() ||
          null,

        userAgent:
          metadata.userAgent
            ?.trim() ||
          null,

        expiresAt:
          this.createExpirationDate(
            this.refreshTtlSeconds,
          ),
      },
    });

    return tokens;
  }

  /*
  |--------------------------------------------------------------------------
  | Platform Admin login
  |--------------------------------------------------------------------------
  */

  private async loginPlatformAdmin(
    platformAdmin:
      SafeUser & {
        passwordHash:
          string | null;
      },

    metadata:
      RequestMetadata,
  ) {
    const tokens =
      await this.createSessionAndTokens(
        platformAdmin.id,
        null,
        null,
        null,
        platformAdmin.platformRole,
        metadata,
      );

    const {
      passwordHash:
        _passwordHash,

      ...safeUser
    } =
      platformAdmin;

    await this.prisma.user.update({
      where: {
        id:
          platformAdmin.id,
      },

      data: {
        lastLoginAt:
          new Date(),
      },
    });

    return {
      user:
        safeUser,

      identity:
        null,

      ...tokens,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | TOKEN SIGNING
  |--------------------------------------------------------------------------
  */

  private async signTokens(
    userId:
      string,

    organizationIdentityId:
      string | null,

    organizationId:
      string | null,

    login:
      string | null,

    sessionId:
      string,

    platformRole:
      PlatformRole,
  ): Promise<AuthTokens> {
    const accessPayload:
      JwtPayload = {
      sub:
        userId,

      sessionId,

      tokenType:
        'access',

      platformRole,

      organizationIdentityId,

      organizationId,

      login,
    };

    const refreshPayload:
      JwtPayload = {
      sub:
        userId,

      sessionId,

      tokenType:
        'refresh',

      platformRole,

      organizationIdentityId,

      organizationId,

      login,
    };

    const [
      accessToken,
      refreshToken,
    ] =
      await Promise.all([
        this.jwtService.signAsync(
          accessPayload,
          {
            secret:
              this.accessSecret,

            expiresIn:
              this.accessTtlSeconds,
          },
        ),

        this.jwtService.signAsync(
          refreshPayload,
          {
            secret:
              this.refreshSecret,

            expiresIn:
              this.refreshTtlSeconds,
          },
        ),
      ]);

    return {
      accessToken,

      refreshToken,

      accessTokenExpiresIn:
        this.accessTtlSeconds,

      refreshTokenExpiresIn:
        this.refreshTtlSeconds,
    };
  }

  /*
  |--------------------------------------------------------------------------
  | Refresh validation
  |--------------------------------------------------------------------------
  */

  private async verifyRefreshToken(
    token:
      string,
  ): Promise<JwtPayload> {
    try {
      const payload =
        await this.jwtService.verifyAsync<JwtPayload>(
          token,
          {
            secret:
              this.refreshSecret,
          },
        );

      if (
        payload.tokenType !==
        'refresh'
      ) {
        throw new UnauthorizedException(
          'Le token fourni n’est pas un refresh token.',
        );
      }

      if (
        !payload.sub ||
        !payload.sessionId
      ) {
        throw new UnauthorizedException(
          'Le refresh token ne contient pas les informations nécessaires.',
        );
      }

      return payload;
    } catch (
      error:
        unknown
    ) {
      if (
        error instanceof
        UnauthorizedException
      ) {
        throw error;
      }

      throw new UnauthorizedException(
        'Refresh token invalide ou expiré.',
      );
    }
  }

  private async revokeSession(
    sessionId:
      string,
  ): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        id:
          sessionId,

        revokedAt:
          null,
      },

      data: {
        revokedAt:
          new Date(),
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | Password / hash helpers
  |--------------------------------------------------------------------------
  */

  private async hashValue(
    value:
      string,
  ): Promise<string> {
    return argon2.hash(
      value,
      {
        type:
          argon2.argon2id,

        memoryCost:
          65_536,

        timeCost:
          3,

        parallelism:
          1,
      },
    );
  }

  private async verifyHash(
    hash:
      string,

    plainValue:
      string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(
        hash,
        plainValue,
      );
    } catch {
      return false;
    }
  }

  private createExpirationDate(
    ttlSeconds:
      number,
  ): Date {
    return new Date(
      Date.now() +
        ttlSeconds *
          1000,
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Config
  |--------------------------------------------------------------------------
  */

  private requiredConfig(
    key:
      string,
  ): string {
    const value =
      this.configService
        .get<string>(
          key,
        )
        ?.trim();

    if (!value) {
      throw new Error(
        `${key} est obligatoire dans les variables d’environnement.`,
      );
    }

    return value;
  }

  private numberConfig(
    key:
      string,

    fallback:
      number,
  ): number {
    const rawValue =
      this.configService.get<
        string |
        number
      >(
        key,
      );

    const value =
      rawValue ===
        undefined ||
      rawValue ===
        null ||
      rawValue ===
        ''
        ? fallback
        : Number(
            rawValue,
          );

    if (
      !Number.isInteger(
        value,
      ) ||
      value <=
        0
    ) {
      throw new Error(
        `${key} doit être un nombre entier positif exprimé en secondes.`,
      );
    }

    return value;
  }
}
