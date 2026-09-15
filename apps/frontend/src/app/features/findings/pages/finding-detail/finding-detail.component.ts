import { Component, OnInit, inject, computed, signal } from '@angular/core';

import { CommonModule } from '@angular/common';

import { FormsModule } from '@angular/forms';

import { ActivatedRoute, Router } from '@angular/router';

import { finalize } from 'rxjs';

import { FindingsService } from '../../services/findings.service';

import type { FindingDetail, FindingStatus } from '../../models/finding.models';

import { FindingAssignmentsService } from '../../services/finding-assignments.service';
import {
  FindingRiskService,
  type FindingRiskAssessment,
} from '../../services/finding-risk.service';

import { AuthContextService } from '../../../../core/auth/auth-context.service';

import { AuthService } from '../../../../core/auth/auth.service';

import { PERMISSIONS } from '../../../../core/auth/auth-context.models';

import {
  ProjectMembersService,
  type ProjectMember,
} from '../../../projects/services/project-members.service';

@Component({
  selector: 'app-finding-detail',

  standalone: true,

  imports: [CommonModule, FormsModule],

  templateUrl: './finding-detail.component.html',

  styleUrl: './finding-detail.component.scss',
})
export class FindingDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  private readonly findingsService = inject(FindingsService);

  private readonly assignments = inject(FindingAssignmentsService);

  private readonly projectMembersService = inject(ProjectMembersService);

  private readonly authContext = inject(AuthContextService);

  private readonly authService = inject(AuthService);

  readonly canReadFinding = computed(() =>
    Boolean(
      this.projectId &&
        this.authContext.canProject(this.projectId, PERMISSIONS.FINDING_READ),
    ),
  );

  readonly canUpdateFinding = computed(() =>
    Boolean(
      this.projectId &&
        this.authContext.canProject(this.projectId, PERMISSIONS.FINDING_UPDATE),
    ),
  );

  readonly canAssignFinding = computed(() =>
    Boolean(
      this.projectId &&
        this.authContext.canProject(this.projectId, PERMISSIONS.FINDING_ASSIGN),
    ),
  );

  readonly canValidateFinding = computed(() => {
    if (!this.projectId) {
      return false;
    }

    if (this.authContext.isOwner()) {
      return true;
    }

    const role = this.authContext.projectRole(this.projectId);

    return role === 'PROJECT_ADMIN' || role === 'MANAGER';
  });

  readonly currentAssignment = signal<any | null>(null);

  readonly assigning = signal(false);

  readonly updatingTask = signal(false);

  readonly isCurrentAssignee = computed(() => {
    const assignedToId = this.currentAssignment()?.assignedToId;

    const currentUserId = this.authService.currentUser()?.id;

    return Boolean(
      assignedToId && currentUserId && assignedToId === currentUserId,
    );
  });

  private readonly findingRiskService = inject(FindingRiskService);

  readonly canStartWork = computed(() => {
    const status = this.finding()?.status;

    return (
      this.isCurrentAssignee() &&
      this.canUpdateFinding() &&
      (status === 'ASSIGNED' || status === 'REOPENED')
    );
  });

  readonly canSubmitForRetest = computed(
    () =>
      this.isCurrentAssignee() &&
      this.canUpdateFinding() &&
      this.finding()?.status === 'IN_PROGRESS',
  );

  readonly canReadRepository = computed(() =>
    Boolean(
      this.projectId &&
        this.authContext.canProject(
          this.projectId,
          PERMISSIONS.REPOSITORY_READ,
        ),
    ),
  );

  readonly canReadScan = computed(() =>
    Boolean(
      this.projectId &&
        this.authContext.canProject(this.projectId, PERMISSIONS.SCAN_READ),
    ),
  );

  readonly members = signal<ProjectMember[]>([]);

  readonly membersLoading = signal(false);

  readonly selectedMemberId = signal('');

  readonly finding = signal<FindingDetail | null>(null);

  readonly riskAssessment = signal<FindingRiskAssessment | null>(null);

  readonly loading = signal(true);

  readonly saving = signal(false);

  readonly error = signal<string | null>(null);

  organizationId = '';

  projectId = '';

  findingId = '';

  selectedStatus: FindingStatus = 'DETECTED';

  comment = '';

  readonly statuses: FindingStatus[] = [
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

  loadAssignableMembers(): void {
    if (!this.organizationId || !this.projectId || !this.canAssignFinding()) {
      this.members.set([]);

      return;
    }

    this.membersLoading.set(true);

    this.projectMembersService
      .list(this.organizationId, this.projectId)
      .pipe(finalize(() => this.membersLoading.set(false)))
      .subscribe({
        next: (members) => {
          this.members.set(
            members.filter((member) => member.user.status === 'ACTIVE'),
          );
        },

        error: (error) => {
          this.members.set([]);

          this.error.set(
            this.readError(
              error,
              'Impossible de charger les membres assignables.',
            ),
          );
        },
      });
  }

  ngOnInit(): void {
    this.organizationId =
      this.route.snapshot.paramMap.get('organizationId') ?? '';

    this.projectId = this.route.snapshot.paramMap.get('projectId') ?? '';

    this.findingId = this.route.snapshot.paramMap.get('findingId') ?? '';

    if (this.canAssignFinding()) {
      this.loadAssignableMembers();
    }

    this.load();
  }

  load(): void {
    if (!this.canReadFinding()) {
      this.error.set("Vous n'avez pas la permission de consulter ce finding.");

      return;
    }
    if (!this.organizationId || !this.projectId || !this.findingId) {
      this.loading.set(false);

      this.error.set('Finding introuvable.');

      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.loadAssignment();
    this.loadRiskAssessment();

    this.findingsService
      .getOne(this.organizationId, this.projectId, this.findingId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (finding) => {
          this.finding.set(finding);

          this.selectedStatus = finding.status;
        },

        error: (error) => {
          this.error.set(
            this.readError(error, 'Impossible de charger le finding.'),
          );
        },
      });
  }

  saveStatus(): void {
    const finding = this.finding();

    if (!this.canUpdateFinding()) {
      this.error.set(
        "Vous n'avez pas la permission de modifier le statut de ce finding.",
      );

      return;
    }

    if (!finding || this.saving() || this.selectedStatus === finding.status) {
      return;
    }

    this.saving.set(true);

    this.error.set(null);

    this.findingsService
      .updateStatus(
        this.organizationId,
        this.projectId,
        finding.id,
        this.selectedStatus,
        this.comment,
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.finding.set(updated);

          this.selectedStatus = updated.status;

          this.comment = '';
        },

        error: (error) => {
          this.error.set(
            this.readError(error, 'Impossible de modifier le statut.'),
          );
        },
      });
  }

  back(): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'findings',
    ]);
  }

  openScan(): void {
    const finding = this.finding();

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

  openRepository(): void {
    const finding = this.finding();

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

  loadAssignment(): void {
    if (!this.organizationId || !this.projectId || !this.findingId) {
      return;
    }

    this.assignments
      .getActive(this.organizationId, this.projectId, this.findingId)
      .subscribe({
        next: (assignment) => {
          this.currentAssignment.set(assignment);
        },

        error: () => {
          this.currentAssignment.set(null);
        },
      });
  }

  assignTo(userId: string): void {
    if (!this.canAssignFinding()) {
      this.error.set("Vous n'avez pas la permission d'assigner ce finding.");

      return;
    }
    if (
      !userId ||
      this.assigning() ||
      !this.organizationId ||
      !this.projectId ||
      !this.findingId
    ) {
      return;
    }

    this.assigning.set(true);
    this.error.set(null);

    this.assignments
      .assign(this.organizationId, this.projectId, this.findingId, userId)
      .pipe(
        finalize(() => {
          this.assigning.set(false);
        }),
      )
      .subscribe({
        next: () => {
          this.selectedMemberId.set('');

          this.loadAssignment();

          this.findingsService
            .getOne(this.organizationId, this.projectId, this.findingId)
            .subscribe({
              next: (finding) => {
                this.finding.set(finding);

                this.selectedStatus = finding.status;
              },
            });
        },

        error: (error) => {
          this.error.set(
            this.readError(error, 'Impossible d’assigner ce finding.'),
          );
        },
      });
  }

  unassign(): void {
    if (!this.canAssignFinding()) {
      this.error.set(
        "Vous n'avez pas la permission de retirer l'affectation de ce finding.",
      );

      return;
    }
    if (
      this.assigning() ||
      !this.organizationId ||
      !this.projectId ||
      !this.findingId
    ) {
      return;
    }

    this.assigning.set(true);
    this.error.set(null);

    this.assignments
      .unassign(this.organizationId, this.projectId, this.findingId)
      .pipe(
        finalize(() => {
          this.assigning.set(false);
        }),
      )
      .subscribe({
        next: () => {
          this.currentAssignment.set(null);
          this.load();
        },

        error: (error) => {
          this.error.set(
            this.readError(error, 'Impossible de retirer l’assignation.'),
          );
        },
      });
  }

  startWork(): void {
    if (!this.canStartWork() || this.updatingTask()) {
      return;
    }

    this.updateAssignedTask(
      this.assignments.startWork(
        this.organizationId,
        this.projectId,
        this.findingId,
      ),
      'Impossible de commencer la correction.',
    );
  }

  submitForRetest(): void {
    if (!this.canSubmitForRetest() || this.updatingTask()) {
      return;
    }

    this.updateAssignedTask(
      this.assignments.markReadyForRetest(
        this.organizationId,
        this.projectId,
        this.findingId,
      ),
      'Impossible de soumettre la correction au retest.',
    );
  }

  private updateAssignedTask(
    request: ReturnType<FindingAssignmentsService['startWork']>,
    fallbackMessage: string,
  ): void {
    this.updatingTask.set(true);
    this.error.set(null);

    request.pipe(finalize(() => this.updatingTask.set(false))).subscribe({
      next: (result) => {
        this.finding.update((finding) =>
          finding
            ? {
                ...finding,
                status: result.finding.status as FindingStatus,
              }
            : finding,
        );

        this.selectedStatus = result.finding.status as FindingStatus;
      },

      error: (error) => {
        this.error.set(this.readError(error, fallbackMessage));
      },
    });
  }

  loadRiskAssessment(): void {
    this.findingRiskService
      .get(this.organizationId, this.projectId, this.findingId)
      .subscribe({
        next: (assessment) => this.riskAssessment.set(assessment),
        error: () => this.riskAssessment.set(null),
      });
  }

  riskPriorityLabel(priority: FindingRiskAssessment['priority']): string {
    const labels: Record<FindingRiskAssessment['priority'], string> = {
      IMMEDIATE: 'Immédiate',
      URGENT: 'Urgente',
      HIGH: 'Élevée',
      MEDIUM: 'Moyenne',
      LOW: 'Faible',
    };
    return labels[priority];
  }

  validateFix(): void {
    this.changeValidationStatus(
      'FIXED',
      'Correction validée par le responsable du projet.',
    );
  }

  reopenTask(): void {
    this.changeValidationStatus(
      'REOPENED',
      'Correction refusée : la vulnérabilité est toujours présente.',
    );
  }

  private changeValidationStatus(
    status: 'FIXED' | 'REOPENED',

    comment: string,
  ): void {
    const finding = this.finding();

    if (
      !finding ||
      !this.canValidateFinding() ||
      finding.status !== 'READY_FOR_RETEST' ||
      this.saving()
    ) {
      return;
    }

    this.saving.set(true);

    this.error.set(null);

    this.findingsService
      .updateStatus(
        this.organizationId,
        this.projectId,
        finding.id,
        status,
        comment,
      )
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.finding.set(updated);

          this.selectedStatus = updated.status;

          this.loadAssignment();
        },

        error: (error) => {
          this.error.set(
            this.readError(error, 'Impossible de valider la correction.'),
          );
        },
      });
  }

  severityClass(severity: string): string {
    return severity.toLowerCase();
  }

  statusLabel(status: FindingStatus): string {
    const labels: Record<FindingStatus, string> = {
      DETECTED: 'Détecté',

      TO_REVIEW: 'À vérifier',

      CONFIRMED: 'Confirmé',

      ASSIGNED: 'Assigné',

      IN_PROGRESS: 'En cours',

      READY_FOR_RETEST: 'Prêt pour retest',

      FALSE_POSITIVE: 'Faux positif',

      ACCEPTED_RISK: 'Risque accepté',

      FIXED: 'Corrigé',

      REOPENED: 'Réouvert',

      CLOSED: 'Fermé',
    };

    return labels[status];
  }

  private readError(
    error: any,

    fallback: string,
  ): string {
    const message = error?.error?.message;

    if (Array.isArray(message)) {
      return message.join(' ');
    }

    return typeof message === 'string' ? message : fallback;
  }
}
