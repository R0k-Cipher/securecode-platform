export type PlatformRole =
  | 'USER'
  | 'PLATFORM_ADMIN';

export interface AuthenticatedUser {
  id: string;

  email: string;

  firstName: string;

  lastName: string;

  avatarUrl:
    string | null;

  platformRole:
    PlatformRole;
}

export interface LoginRequest {
  email: string;

  password: string;
}

export interface RegisterRequest {
  email: string;

  firstName: string;

  lastName: string;

  password: string;

  organizationName:
    string;

  organizationDescription?:
    string;
}

export interface InitialOrganization {
  id: string;

  name: string;

  slug: string;
}

export interface LoginResponse {
  user:
    AuthenticatedUser;

  accessToken:
    string;

  refreshToken:
    string;

  accessTokenExpiresIn:
    number;

  refreshTokenExpiresIn:
    number;
}

export interface AuthResponse
  extends LoginResponse {
  organization:
    InitialOrganization;
}
