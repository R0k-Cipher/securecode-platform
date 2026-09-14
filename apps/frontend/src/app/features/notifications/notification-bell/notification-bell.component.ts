import {
  CommonModule,
} from '@angular/common';

import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import {
  takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
  interval,
} from 'rxjs';

import {
  Router,
} from '@angular/router';

import {
  AuthService,
} from '../../../core/auth/auth.service';

import {
  NotificationsService,
  type AppNotification,
} from '../notifications.service';

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

  private readonly auth =
    inject(
      AuthService,
    );

  private readonly router =
    inject(
      Router,
    );

  private readonly elementRef =
    inject(
      ElementRef<HTMLElement>,
    );

  private readonly destroyRef =
    inject(
      DestroyRef,
    );

  readonly open =
    signal(
      false,
    );

  readonly loading =
    signal(
      false,
    );

  readonly visibleNotifications =
    computed(
      () =>
        this.notifications
          .items()
          .slice(
            0,
            20,
          ),
    );

  constructor() {
    effect(
      () => {
        const user =
          this.auth.currentUser();

        if (!user) {
          this.notifications.clear();

          return;
        }

        this.refresh();
      },
    );

    interval(
      15_000,
    )
      .pipe(
        takeUntilDestroyed(
          this.destroyRef,
        ),
      )
      .subscribe(
        () => {
          if (
            this.auth.currentUser()
          ) {
            this.refresh();
          }
        },
      );
  }

  toggle(
    event?:
      Event,
  ):
    void {
    event?.stopPropagation();

    this.open.update(
      value =>
        !value,
    );

    if (
      this.open()
    ) {
      this.refresh();
    }
  }

  close():
    void {
    this.open.set(
      false,
    );
  }

  refresh():
    void {
    if (
      this.loading()
    ) {
      return;
    }

    this.loading.set(
      true,
    );

    this.notifications
      .refresh()
      .subscribe({
        next:
          () => {
            this.loading.set(
              false,
            );
          },

        error:
          () => {
            this.loading.set(
              false,
            );
          },
      });
  }

  readAll():
    void {
    if (
      this.notifications
        .unread() ===
      0
    ) {
      return;
    }

    this.notifications
      .markAllRead()
      .subscribe();
  }

  openItem(
    item:
      AppNotification,
  ):
    void {
    if (
      !item.readAt
    ) {
      this.notifications
        .markRead(
          item.id,
        )
        .subscribe();
    }

    const metadata =
      item.metadata ??
      {};

    const organizationId =
      this.stringMetadata(
        metadata,
        'organizationId',
      );

    const projectId =
      this.stringMetadata(
        metadata,
        'projectId',
      );

    /*
    |--------------------------------------------------------------------------
    | Finding
    |--------------------------------------------------------------------------
    */

    const findingId =
      this.stringMetadata(
        metadata,
        'findingId',
      );

    if (
      organizationId &&
      projectId &&
      findingId
    ) {
      this.close();

      void this.router.navigate([
        '/organizations',
        organizationId,
        'projects',
        projectId,
        'findings',
        findingId,
      ]);

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Scan
    |--------------------------------------------------------------------------
    */

    const scanId =
      this.stringMetadata(
        metadata,
        'scanId',
      );

    if (
      organizationId &&
      projectId &&
      scanId
    ) {
      this.close();

      void this.router.navigate([
        '/organizations',
        organizationId,
        'projects',
        projectId,
        'scans',
        scanId,
      ]);

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Report
    |--------------------------------------------------------------------------
    */

    const reportId =
      this.stringMetadata(
        metadata,
        'reportId',
      );

    if (
      organizationId &&
      projectId &&
      reportId
    ) {
      this.close();

      void this.router.navigate([
        '/organizations',
        organizationId,
        'projects',
        projectId,
        'reports',
      ]);

      return;
    }

    /*
    |--------------------------------------------------------------------------
    | Organization
    |--------------------------------------------------------------------------
    */

    if (
      organizationId &&
      item.type !==
        'INVITATION'
    ) {
      this.close();

      void this.router.navigate([
        '/organizations',
        organizationId,
        'dashboard',
      ]);
    }

    /*
     * INVITATION :
     *
     * On ne déclenche volontairement aucune acceptation/refus
     * directement depuis le dropdown.
     *
     * L'utilisateur doit passer par le vrai workflow
     * d'invitation dédié.
     */
  }

  icon(
    item:
      AppNotification,
  ):
    string {
    switch (
      item.type
    ) {
      case 'INVITATION':
        return 'I';

      case 'SCAN_STARTED':
      case 'SCAN_COMPLETED':
      case 'SCAN_FAILED':
        return 'S';

      case 'REPORT_READY':
        return 'R';

      case 'FINDING_ASSIGNED':
      case 'FINDING_UPDATED':
        return 'F';

      case 'SYSTEM':
        return 'SYS';

      default:
        return 'N';
    }
  }

  typeLabel(
    item:
      AppNotification,
  ):
    string {
    switch (
      item.type
    ) {
      case 'INVITATION':
        return 'Invitation';

      case 'SCAN_STARTED':
        return 'Scan démarré';

      case 'SCAN_COMPLETED':
        return 'Scan terminé';

      case 'SCAN_FAILED':
        return 'Échec du scan';

      case 'REPORT_READY':
        return 'Rapport';

      case 'FINDING_ASSIGNED':
        return 'Finding assigné';

      case 'FINDING_UPDATED':
        return 'Finding mis à jour';

      case 'SYSTEM':
        return 'Système';

      default:
        return 'Notification';
    }
  }

  hasNavigation(
    item:
      AppNotification,
  ):
    boolean {
    const metadata =
      item.metadata ??
      {};

    const organizationId =
      this.stringMetadata(
        metadata,
        'organizationId',
      );

    const projectId =
      this.stringMetadata(
        metadata,
        'projectId',
      );

    if (
      !organizationId
    ) {
      return false;
    }

    if (
      item.type ===
      'INVITATION'
    ) {
      return false;
    }

    if (
      projectId
    ) {
      return true;
    }

    return true;
  }

  actionLabel(
    item:
      AppNotification,
  ):
    string {
    switch (
      item.type
    ) {
      case 'REPORT_READY':
        return 'Voir les rapports';

      case 'SCAN_STARTED':
      case 'SCAN_COMPLETED':
      case 'SCAN_FAILED':
        return 'Voir le scan';

      case 'FINDING_ASSIGNED':
      case 'FINDING_UPDATED':
        return 'Voir le finding';

      default:
        return 'Consulter';
    }
  }

  @HostListener(
    'document:click',
    [
      '$event',
    ],
  )
  onDocumentClick(
    event:
      MouseEvent,
  ):
    void {
    if (
      !this.open()
    ) {
      return;
    }

    const target =
      event.target;

    if (
      target instanceof
        Node &&
      !this.elementRef
        .nativeElement
        .contains(
          target,
        )
    ) {
      this.close();
    }
  }

  @HostListener(
    'document:keydown.escape',
  )
  onEscape():
    void {
    this.close();
  }

  private stringMetadata(
    metadata:
      Record<
        string,
        unknown
      >,

    key:
      string,
  ):
    string |
    null {
    const value =
      metadata[
        key
      ];

    return typeof value ===
      'string' &&
      value.length >
        0
      ? value
      : null;
  }
}
