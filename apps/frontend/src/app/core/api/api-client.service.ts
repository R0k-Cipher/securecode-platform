import {
  Injectable,
  inject,
} from '@angular/core';

import {
  HttpClient,
  HttpParams,
} from '@angular/common/http';

import {
  Observable,
} from 'rxjs';

import {
  environment,
} from '../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private readonly http =
    inject(HttpClient);

  private readonly baseUrl =
    environment.apiUrl;

  get<T>(
    path: string,
    params?: Record<
      string,
      string |
      number |
      boolean |
      undefined |
      null
    >,
  ): Observable<T> {
    return this.http.get<T>(
      this.url(path),
      {
        params:
          this.createParams(
            params,
          ),
      },
    );
  }

  post<T>(
    path: string,
    body?: unknown,
  ): Observable<T> {
    return this.http.post<T>(
      this.url(path),
      body ?? {},
    );
  }

  patch<T>(
    path: string,
    body: unknown,
  ): Observable<T> {
    return this.http.patch<T>(
      this.url(path),
      body,
    );
  }

  delete<T>(
    path: string,
  ): Observable<T> {
    return this.http.delete<T>(
      this.url(path),
    );
  }

  private url(
    path: string,
  ): string {
    const normalized =
      path.startsWith('/')
        ? path
        : `/${path}`;

    return `${this.baseUrl}${normalized}`;
  }

  private createParams(
    values?: Record<
      string,
      string |
      number |
      boolean |
      undefined |
      null
    >,
  ): HttpParams {
    let params =
      new HttpParams();

    if (!values) {
      return params;
    }

    for (
      const [
        key,
        value,
      ] of Object.entries(
        values,
      )
    ) {
      if (
        value ===
          undefined ||
        value ===
          null ||
        value ===
          ''
      ) {
        continue;
      }

      params =
        params.set(
          key,
          String(
            value,
          ),
        );
    }

    return params;
  }
}
