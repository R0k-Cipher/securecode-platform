import {
  Injectable,
} from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class TokenStorageService {
  private readonly accessTokenKey =
    'securecode_access_token';

  private readonly refreshTokenKey =
    'securecode_refresh_token';

  getAccessToken():
    string | null {
    return localStorage.getItem(
      this.accessTokenKey,
    );
  }

  setAccessToken(
    token: string,
  ): void {
    localStorage.setItem(
      this.accessTokenKey,
      token,
    );
  }

  getRefreshToken():
    string | null {
    return localStorage.getItem(
      this.refreshTokenKey,
    );
  }

  setRefreshToken(
    token: string,
  ): void {
    localStorage.setItem(
      this.refreshTokenKey,
      token,
    );
  }

  clear(): void {
    localStorage.removeItem(
      this.accessTokenKey,
    );

    localStorage.removeItem(
      this.refreshTokenKey,
    );
  }
}
