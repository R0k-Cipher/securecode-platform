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
  ActivatedRoute,
  Router,
} from '@angular/router';

import {
  finalize,
} from 'rxjs';

import {
  FindingAssignmentsService,
} from '../../services/finding-assignments.service';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [
    CommonModule,
  ],
  templateUrl:
    './my-tasks.component.html',
  styleUrl:
    './my-tasks.component.scss',
})
export class MyTasksComponent
  implements OnInit
{
  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly assignments =
    inject(
      FindingAssignmentsService,
    );

  readonly tasks =
    signal<any[]>([]);

  readonly loading =
    signal(false);

  readonly updatingFindingId =
    signal<string | null>(
      null,
    );

  readonly success =
    signal<string | null>(
      null,
    );

  readonly error =
    signal<string | null>(null);

    organizationId = '';
    projectId = '';

  ngOnInit(): void {
    this.organizationId =
      this.route.snapshot
        .paramMap
        .get('organizationId') ?? '';

    this.projectId =
      this.route.snapshot
        .paramMap
        .get('projectId') ?? '';

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this.assignments
      .myTasks(
        this.organizationId,
        this.projectId,
      )
      .subscribe({
        next: (result: any) => {
          this.tasks.set(
            Array.isArray(result)
              ? result
              : result?.items ?? [],
          );

          this.loading.set(false);
        },

        error: () => {
          this.loading.set(false);

          this.error.set(
            'Impossible de charger vos tâches.',
          );
        },
      });
  }

  openFinding(
    findingId: string,
  ): void {
    void this.router.navigate([
      '/organizations',
      this.organizationId,
      'projects',
      this.projectId,
      'findings',
      findingId,
    ]);
  }

  markAsFixed(
    findingId: string,
  ):
    void {
    if (
      this.updatingFindingId()
    ) {
      return;
    }

    this.updatingFindingId.set(
      findingId,
    );

    this.error.set(
      null,
    );

    this.success.set(
      null,
    );

    this.assignments
      .markReadyForRetest(
        this.organizationId,
        this.projectId,
        findingId,
      )
      .pipe(
        finalize(
          () =>
            this.updatingFindingId.set(
              null,
            ),
        ),
      )
      .subscribe({
        next:
          response => {
            this.success.set(
              response.message,
            );

            /*
            * La tâche reste visible, mais passe
            * au statut READY_FOR_RETEST.
            */
            this.tasks.update(
              tasks =>
                tasks.map(
                  task =>
                    task.finding.id ===
                    findingId
                      ? {
                          ...task,

                          finding: {
                            ...task.finding,

                            status:
                              'READY_FOR_RETEST',
                          },
                        }
                      : task,
                ),
            );
          },

        error:
          error => {
            const message =
              error?.error?.message;

            this.error.set(
              Array.isArray(
                message,
              )
                ? message.join(' ')
                : typeof message ===
                    'string'
                  ? message
                  : 'Impossible de signaler la correction.',
            );
          },
      });
  }
}
