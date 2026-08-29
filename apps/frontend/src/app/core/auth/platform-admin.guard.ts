import {
  inject,
} from '@angular/core';

import type {
  CanActivateFn,
} from '@angular/router';

import {
  Router,
} from '@angular/router';

import {
  TokenStorageService,
} from '../storage/token-storage.service';

interface JwtPayload {
  sub?: string;
  email?: string;
  platformRole?: string;
  exp?: number;
}

function decodeJwtPayload(
  token: string,
): JwtPayload | null {
  try {
    const parts =
      token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const base64Url =
      parts[1];

    const base64 =
      base64Url
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .padEnd(
          Math.ceil(
            base64Url.length / 4,
          ) * 4,
          '=',
        );

    const binary =
      atob(base64);

    const bytes =
      Uint8Array.from(
        binary,
        (char) =>
          char.charCodeAt(0),
      );

    const decoded =
      new TextDecoder()
        .decode(bytes);

    return JSON.parse(
      decoded,
    ) as JwtPayload;
  } catch {
    return null;
  }
}

export const platformAdminGuard:
  CanActivateFn =
  () => {
    const router =
      inject(Router);

    const tokenStorage =
      inject(
        TokenStorageService,
      );

    const token =
      tokenStorage
        .getAccessToken();

    if (!token) {
      return router
        .createUrlTree([
          '/login',
        ]);
    }

    const payload =
      decodeJwtPayload(
        token,
      );

    const now =
      Math.floor(
        Date.now() / 1000,
      );

    if (
      payload?.exp &&
      payload.exp <= now
    ) {
      return router
        .createUrlTree([
          '/login',
        ]);
    }

    if (
      payload?.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      return true;
    }

    return router
      .createUrlTree([
        '/organizations',
      ]);
  };
