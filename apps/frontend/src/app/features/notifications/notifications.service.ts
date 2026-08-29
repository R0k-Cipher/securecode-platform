import {
  Injectable,
  inject,
  signal,
} from '@angular/core';

import {
  ApiClientService,
} from '../../core/api/api-client.service';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  metadata: unknown;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly api =
    inject(
      ApiClientService,
    );

  readonly unread =
    signal(
      0,
    );

  readonly items =
    signal<
      AppNotification[]
    >(
      [],
    );

  load() {
    return this.api
      .get<{
        data: AppNotification[];
        unread: number;
      }>(
        '/notifications',
        {
          limit:
            50,
        },
      );
  }

  refresh(): void {
    this.load()
      .subscribe(
        (
          response,
        ) => {
          this.items.set(
            response.data,
          );

          this.unread.set(
            response.unread,
          );
        },
      );
  }

  markRead(
    id: string,
  ) {
    return this.api
      .patch<{
        success: boolean;
      }>(
        `/notifications/${id}/read`,
        {},
      );
  }

  markAllRead() {
    return this.api
      .patch<{
        updated: number;
      }>(
        '/notifications/read-all',
        {},
      );
  }
}
