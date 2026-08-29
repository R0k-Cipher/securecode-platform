import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  mkdir,
  realpath,
  rm,
} from 'node:fs/promises';

import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';

import {
  randomUUID,
} from 'node:crypto';

@Injectable()
export class RepositoryWorkspaceService {
  private readonly workspaceRoot: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    const configuredRoot =
      this.configService.get<string>(
        'SCANNER_WORKSPACE_ROOT',
      );

    if (
      !configuredRoot ||
      configuredRoot.trim().length === 0
    ) {
      throw new InternalServerErrorException(
        'SCANNER_WORKSPACE_ROOT est manquant.',
      );
    }

    this.workspaceRoot =
      resolve(configuredRoot);
  }

  async createWorkspace(
    repositorySyncId: string,
  ): Promise<string> {
    await mkdir(
      this.workspaceRoot,
      {
        recursive: true,
      },
    );

    const workspaceId =
      `${repositorySyncId}-${randomUUID()}`;

    const workspacePath =
      resolve(
        join(
          this.workspaceRoot,
          workspaceId,
        ),
      );

    this.assertInsideWorkspaceRoot(
      workspacePath,
    );

    await mkdir(
      workspacePath,
      {
        recursive: false,
      },
    );

    return workspacePath;
  }

  async cleanupWorkspace(
    workspacePath: string,
  ): Promise<void> {
    if (!workspacePath) {
      return;
    }

    const resolvedPath =
      resolve(workspacePath);

    this.assertInsideWorkspaceRoot(
      resolvedPath,
    );

    if (
      resolvedPath ===
      this.workspaceRoot
    ) {
      throw new InternalServerErrorException(
        'Tentative de suppression de la racine des workspaces.',
      );
    }

    await rm(
      resolvedPath,
      {
        recursive: true,
        force: true,
        maxRetries: 3,
        retryDelay: 250,
      },
    );
  }

  async assertWorkspaceExists(
    workspacePath: string,
  ): Promise<string> {
    const resolvedPath =
      resolve(workspacePath);

    this.assertInsideWorkspaceRoot(
      resolvedPath,
    );

    const realWorkspacePath =
      await realpath(
        resolvedPath,
      );

    this.assertInsideWorkspaceRoot(
      realWorkspacePath,
    );

    return realWorkspacePath;
  }

  private assertInsideWorkspaceRoot(
    candidatePath: string,
  ): void {
    if (
      !isAbsolute(candidatePath)
    ) {
      throw new InternalServerErrorException(
        'Le chemin du workspace doit être absolu.',
      );
    }

    const normalizedRoot =
      this.workspaceRoot.endsWith('\\') ||
      this.workspaceRoot.endsWith('/')
        ? this.workspaceRoot
        : `${this.workspaceRoot}${process.platform === 'win32' ? '\\' : '/'}`;

    const normalizedCandidate =
      resolve(candidatePath);

    if (
      normalizedCandidate !==
        this.workspaceRoot &&
      !normalizedCandidate.startsWith(
        normalizedRoot,
      )
    ) {
      throw new InternalServerErrorException(
        'Le workspace se trouve hors de la racine autorisée.',
      );
    }
  }
}
