import {
  inject,
} from '@angular/core';

import type {
  HttpInterceptorFn,
} from '@angular/common/http';

import {
  TokenStorageService,
} from '../storage/token-storage.service';

export const authInterceptor:
  HttpInterceptorFn =
  (
    request,
    next,
  ) => {
    const storage =
      inject(
        TokenStorageService,
      );

    const token =
      storage
        .getAccessToken();

    if (!token) {
      return next(
        request,
      );
    }

    return next(
      request.clone({
        setHeaders: {
          Authorization:
            `Bearer ${token}`,
        },
      }),
    );
  };
