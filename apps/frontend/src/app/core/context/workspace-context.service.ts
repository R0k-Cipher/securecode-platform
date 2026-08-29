import {
  Injectable,
  computed,
  signal,
} from '@angular/core';

export interface WorkspaceOrganization {
  id:
    string;

  name:
    string;

  slug?:
    string;

  roleCode?:
    string | null;
}

export interface WorkspaceProject {
  id:
    string;

  name:
    string;

  slug?:
    string;

  status?:
    string;
}

interface PersistedWorkspace {
  organization:
    WorkspaceOrganization |
    null;

  project:
    WorkspaceProject |
    null;
}

@Injectable({
  providedIn:
    'root',
})
export class WorkspaceContextService {
  private readonly storageKey =
    'securecode_workspace';

  private readonly initialState =
    this.readStoredState();

  private readonly organizationState =
    signal<
      WorkspaceOrganization |
      null
    >(
      this.initialState
        .organization,
    );

  private readonly projectState =
    signal<
      WorkspaceProject |
      null
    >(
      this.initialState
        .project,
    );

  readonly organization =
    this.organizationState
      .asReadonly();

  readonly project =
    this.projectState
      .asReadonly();

  readonly organizationId =
    computed(
      () =>
        this.organizationState()
          ?.id ??
        null,
    );

  readonly projectId =
    computed(
      () =>
        this.projectState()
          ?.id ??
        null,
    );

  setOrganization(
    organization:
      WorkspaceOrganization,
  ): void {
    const current =
      this.organizationState();

    if (
      current?.id !==
      organization.id
    ) {
      this.projectState
        .set(null);
    }

    this.organizationState
      .set(
        organization,
      );

    this.persist();
  }

  setProject(
    project:
      WorkspaceProject,
  ): void {
    this.projectState
      .set(
        project,
      );

    this.persist();
  }

  clearProject():
    void {
    this.projectState
      .set(null);

    this.persist();
  }

  clear():
    void {
    this.organizationState
      .set(null);

    this.projectState
      .set(null);

    this.persist();
  }

  private persist():
    void {
    if (
      typeof localStorage ===
      'undefined'
    ) {
      return;
    }

    const state:
      PersistedWorkspace = {
      organization:
        this.organizationState(),

      project:
        this.projectState(),
    };

    localStorage.setItem(
      this.storageKey,
      JSON.stringify(
        state,
      ),
    );
  }

  private readStoredState():
    PersistedWorkspace {
    const empty:
      PersistedWorkspace = {
      organization:
        null,

      project:
        null,
    };

    if (
      typeof localStorage ===
      'undefined'
    ) {
      return empty;
    }

    try {
      const raw =
        localStorage.getItem(
          this.storageKey,
        );

      if (!raw) {
        return empty;
      }

      const parsed =
        JSON.parse(
          raw,
        ) as
          Partial<
            PersistedWorkspace
          >;

      return {
        organization:
          parsed.organization ??
          null,

        project:
          parsed.project ??
          null,
      };
    } catch {
      localStorage.removeItem(
        this.storageKey,
      );

      return empty;
    }
  }
}
