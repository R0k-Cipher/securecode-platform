import {
  Injectable,
} from '@nestjs/common';

import {
  Observable,
  Subject,
} from 'rxjs';

export interface ScanProgressEvent {
  scanId: string;

  status: string;

  progress: number;

  score?: number | null;

  errorMessage?: string | null;

  timestamp: string;
}

@Injectable()
export class ScanEventsService {
  private readonly streams =
    new Map<
      string,
      Subject<ScanProgressEvent>
    >();

  observe(
    scanId: string,
  ): Observable<ScanProgressEvent> {
    return this.getSubject(
      scanId,
    ).asObservable();
  }

  emit(
    event: ScanProgressEvent,
  ): void {
    this.getSubject(
      event.scanId,
    ).next(
      event,
    );
  }

  complete(
    scanId: string,
  ): void {
    const subject =
      this.streams.get(
        scanId,
      );

    if (!subject) {
      return;
    }

    subject.complete();

    this.streams.delete(
      scanId,
    );
  }

  private getSubject(
    scanId: string,
  ): Subject<ScanProgressEvent> {
    let subject =
      this.streams.get(
        scanId,
      );

    if (!subject) {
      subject =
        new Subject<ScanProgressEvent>();

      this.streams.set(
        scanId,
        subject,
      );
    }

    return subject;
  }
}
