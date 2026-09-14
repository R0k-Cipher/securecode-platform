import type {
  PlatformRole,
} from '@prisma/client';

export type JwtTokenType =
  | 'access'
  | 'refresh';

export interface JwtPayload {
  sub:
    string;

  sessionId:
    string;

  tokenType:
    JwtTokenType;

  platformRole:
    PlatformRole;

  organizationIdentityId:
    string | null;

  organizationId:
    string | null;

  login:
    string | null;

  iat?:
    number;

  exp?:
    number;
}

export interface AuthenticatedUser {
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

  sessionId:
    string;

  platformRole:
    PlatformRole;

  organizationIdentityId:
    string | null;

  organizationId:
    string | null;

  login:
    string | null;
}
