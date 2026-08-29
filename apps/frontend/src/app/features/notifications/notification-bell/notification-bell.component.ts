import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  inject,
  effect,
  signal,
} from '@angular/core';

import {
  NotificationsService,
  type AppNotification,
} from '../notifications.service';

import {
  AuthService,
} from '../../../core/auth/auth.service';

@Component({
  selector:
    'app-notification-bell',

  standalone:
    true,

  imports: [
    CommonModule,
  ],

  templateUrl:
    './notification-bell.component.html',

  styleUrl:
    './notification-bell.component.scss',
})
export class NotificationBellComponent {
  readonly notifications =
    inject(
      NotificationsService,
    );

  readonly open =
    signal(
      false,
    );

  private readonly auth =
    inject(
      AuthService,
    );

  constructor() {
    effect(
      () => {
        if (
          this.auth
            .currentUser()
        ) {
          this.notifications
            .refresh();
        }
      },
    );
  }
  toggle():
    void {
    this.open.update(
      (
        value,
      ) =>
        !value,
    );

    if (
      this.open()
    ) {
      this.notifications
        .refresh();
    }
  }

  read(
    item: AppNotification,
  ):
    void {
    if (
      item.readAt
    ) {
      return;
    }

    this.notifications
      .markRead(
        item.id,
      )
      .subscribe(
        () =>
          this.notifications
            .refresh(),
      );
  }

  readAll():
    void {
    this.notifications
      .markAllRead()
      .subscribe(
        () =>
          this.notifications
            .refresh(),
      );
  }
}
