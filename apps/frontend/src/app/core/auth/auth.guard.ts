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

export const authGuard:
  CanActivateFn =
  () => {
    const token =
      inject(
        TokenStorageService,
      )
        .getAccessToken();

    if (token) {
      return true;
    }

    return inject(
      Router,
    ).createUrlTree(
      [
        '/login',
      ],
    );
  };
