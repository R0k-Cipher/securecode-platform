import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import {
  CommonModule,
} from '@angular/common';

import {
  FormsModule,
} from '@angular/forms';

import {
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  finalize,
} from 'rxjs';

import {
  FindingsService,
} from '../../services/findings.service';

import type {
  FindingDetail,
  FindingStatus,
} from '../../models/finding.models';

@Component({
  selector:
    'app-finding-detail',

  standalone:
    true,

  imports: [
    CommonModule,
    FormsModule,
  ],

  templateUrl:
    './finding-detail.component.html',

  styleUrl:
    './finding-detail.component.scss',
})
export class FindingDetailComponent
  implements OnInit
{
  private readonly route =
    inject(
      ActivatedRoute,
    );

  private readonly router =
    inject(
      Router,
    );

  private readonly findingsService =
    inject(
      FindingsService,
    );

  readonly finding =
    signal<
      FindingDetail |
      null
    >(null);

  readonly loading =
    signal(true);

  readonly saving =
    signal(false);

  readonly error =
    signal<
      string |
      null
    >(null);

  organizationId =
    '';

  projectId =
    '';

  findingId =
    '';

  selectedStatus:
    FindingStatus =
    'DETECTED';

  comment =
    '';

  readonly statuses:
    FindingStatus[] = [
      'DETECTED',
      'TO_REVIEW',
      'CONFIRMED',
      'ASSIGNED',
      'IN_PROGRESS',
      'READY_FOR_RETEST',
      'FALSE_POSITIVE',
      'ACCEPTED_RISK',
      'FIXED',
      'REOPENED',
      'CLOSED',
    ];

  ngOnInit():
    void {
    this.organizationId =
      this.route.snapshot
        .paramMap
        .get(
          'organizationId',
        ) ?? '';

    this.projectId =
      this.route.snapshot
        .paramMap
        .get(
          'projectId',
        ) ?? '';

    this.findingId =
      this.route.snapshot
        .paramMap
        .get(
          'findingId',
        ) ?? '';

    this.load();
  }

  load():
    void {
    if (
      !this.organizationId ||
      !this.projectId ||
      !this.findingId
    ) {
      this.loading.set(
        false,
      );

      this.error.set(
        'Finding introuvable.',
      );

      return;
    }

    this.loading.set(
      true,
    );

    this.error.set(
      null,
    );

    this.findingsService
      .getOne(
        this.organizationId,
        this.projectId,
        this.findingId,
      )
      .pipe(
        finalize(
          () =>
            this.loading.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          (
            finding,
          ) => {
            this.finding.set(
              finding,
            );

            this.selectedStatus =
              finding.status;
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              this.readError(
                error,
                'Impossible de charger le finding.',
              ),
            );
          },
      });
  }

  saveStatus():
    void {
    const finding =
      this.finding();

    if (
      !finding ||
      this.saving() ||
      this.selectedStatus ===
        finding.status
    ) {
      return;
    }

    this.saving.set(
      true,
    );

    this.error.set(
      null,
    );

    this.findingsService
      .updateStatus(
        this.organizationId,
        this.projectId,
        finding.id,
        this.selectedStatus,
        this.comment,
      )
      .pipe(
        finalize(
          () =>
            this.saving.set(
              false,
            ),
        ),
      )
      .subscribe({
        next:
          (
            updated,
          ) => {
            this.finding.set(
              updated,
            );

            this.selectedStatus =
              updated.status;

            this.comment =
              '';
          },

        error:
          (
            error,
          ) => {
            this.error.set(
              this.readError(
                error,
                'Impossible de modifier le statut.',
              ),
            );
          },
      });
  }

  back():
    void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'findings',
    ]);
  }

  openScan():
    void {
    const finding =
      this.finding();

    if (!finding) {
      return;
    }

    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'scans',
      finding.scan.id,
    ]);
  }

  openRepository():
    void {
    const finding =
      this.finding();

    if (!finding) {
      return;
    }

    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'repositories',
      finding.repository.id,
    ]);
  }

  severityClass(
    severity:
      string,
  ): string {
    return severity
      .toLowerCase();
  }

  statusLabel(
    status:
      FindingStatus,
  ): string {
    const labels:
      Record<
        FindingStatus,
        string
      > = {
      DETECTED:
        'Détecté',

      TO_REVIEW:
        'À vérifier',

      CONFIRMED:
        'Confirmé',

      ASSIGNED:
        'Assigné',

      IN_PROGRESS:
        'En cours',

      READY_FOR_RETEST:
        'Prêt pour retest',

      FALSE_POSITIVE:
        'Faux positif',

      ACCEPTED_RISK:
        'Risque accepté',

      FIXED:
        'Corrigé',

      REOPENED:
        'Réouvert',

      CLOSED:
        'Fermé',
    };

    return labels[
      status
    ];
  }

  private readError(
    error:
      any,

    fallback:
      string,
  ): string {
    const message =
      error?.error
        ?.message;

    if (
      Array.isArray(
        message,
      )
    ) {
      return message.join(
        ' ',
      );
    }

    return typeof message ===
      'string'
        ? message
        : fallback;
  }
}
