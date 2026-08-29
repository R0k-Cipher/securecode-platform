import {
  Injectable,
  inject,
} from '@angular/core';

import {
  Observable,
  switchMap,
  takeWhile,
  timer,
} from 'rxjs';

import {
  ScansService,
} from './scans.service';

import type {
  ScanProgress,
} from '../models/scan.models';

@Injectable({
  providedIn: 'root',
})
export class ScanProgressService {
  private readonly scans =
    inject(ScansService);

  watch(
    organizationId:
      string,

    projectId:
      string,

    scanId:
      string,

    intervalMs =
      2000,
  ): Observable<ScanProgress> {
    return timer(
      0,
      intervalMs,
    ).pipe(
      switchMap(
        () =>
          this.scans.progress(
            organizationId,
            projectId,
            scanId,
          ),
      ),

      takeWhile(
        (
          progress,
        ) =>
          !this.isTerminal(
            progress.status,
          ),
        true,
      ),
    );
  }

  private isTerminal(
    status:
      string,
  ): boolean {
    return [
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ].includes(
      status,
    );
  }
}
