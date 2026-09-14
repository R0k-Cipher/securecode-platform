export type PlatformRole =
  | 'USER'
  | 'PLATFORM_ADMIN';

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

  status?:
    string;

  emailVerifiedAt?:
    string | null;

  lastLoginAt?:
    string | null;

  platformRole:
    PlatformRole;

  sessionId?:
    string;

  organizationIdentityId?:
    string | null;

  organizationId?:
    string | null;

  login?:
    string | null;
}

export interface LoginRequest {
  identifier:
    string;

  password:
    string;
}

export interface LoginIdentity {
  id:
    string;

  login:
    string;

  mustChangePassword?:
    boolean;

  organization: {
    id:
      string;

    name:
      string;

    slug:
      string;
  };
}

export interface LoginResponse {
  user:
    AuthenticatedUser;

  identity:
    LoginIdentity |
    null;

  accessToken:
    string;

  refreshToken:
    string;

  accessTokenExpiresIn:
    number;

  refreshTokenExpiresIn:
    number;
}

export interface RegisterRequest {
  email:
    string;

  password:
    string;

  firstName:
    string;

  lastName:
    string;

  organizationName:
    string;

  organizationDescription?:
    string;
}

export interface RegisterOrganization {
  id:
    string;

  name:
    string;

  slug:
    string;
}

export interface RegisterResponse {
  user:
    AuthenticatedUser;

  organization:
    RegisterOrganization;

  accessToken:
    string;

  refreshToken:
    string;

  accessTokenExpiresIn:
    number;

  refreshTokenExpiresIn:
    number;
}
