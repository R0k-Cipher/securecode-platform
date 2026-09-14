import {
  Injectable,
  inject,
  signal,
} from '@angular/core';

import {
  Observable,
  tap,
} from 'rxjs';

import {
  ApiClientService,
} from '../../core/api/api-client.service';

export interface AppNotification {
  id:
    string;

  type:
    string;

  title:
    string;

  message:
    string;

  readAt:
    string |
    null;

  metadata:
    Record<
      string,
      unknown
    > |
    null;

  createdAt:
    string;
}

interface NotificationsResponse {
  data:
    AppNotification[];

  unread:
    number;
}

@Injectable({
  providedIn:
    'root',
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

  load():
    Observable<
      NotificationsResponse
    > {
    return this.api
      .get<
        NotificationsResponse
      >(
        '/notifications',
        {
          limit:
            50,
        },
      );
  }

  refresh():
    Observable<
      NotificationsResponse
    > {
    return this.load()
      .pipe(
        tap(
          response => {
            this.items.set(
              response.data,
            );

            this.unread.set(
              response.unread,
            );
          },
        ),
      );
  }

  markRead(
    id:
      string,
  ):
    Observable<{
      success:
        boolean;
    }> {
    return this.api
      .patch<{
        success:
          boolean;
      }>(
        `/notifications/${id}/read`,
        {},
      )
      .pipe(
        tap(
          () => {
            const now =
              new Date()
                .toISOString();

            let changed =
              false;

            this.items.update(
              items =>
                items.map(
                  item => {
                    if (
                      item.id !==
                        id ||
                      item.readAt
                    ) {
                      return item;
                    }

                    changed =
                      true;

                    return {
                      ...item,

                      readAt:
                        now,
                    };
                  },
                ),
            );

            if (
              changed
            ) {
              this.unread.update(
                count =>
                  Math.max(
                    0,
                    count - 1,
                  ),
              );
            }
          },
        ),
      );
  }

  markAllRead():
    Observable<{
      updated:
        number;
    }> {
    return this.api
      .patch<{
        updated:
          number;
      }>(
        '/notifications/read-all',
        {},
      )
      .pipe(
        tap(
          () => {
            const now =
              new Date()
                .toISOString();

            this.items.update(
              items =>
                items.map(
                  item =>
                    item.readAt
                      ? item
                      : {
                          ...item,

                          readAt:
                            now,
                        },
                ),
            );

            this.unread.set(
              0,
            );
          },
        ),
      );
  }

  clear():
    void {
    this.items.set(
      [],
    );

    this.unread.set(
      0,
    );
  }
}
