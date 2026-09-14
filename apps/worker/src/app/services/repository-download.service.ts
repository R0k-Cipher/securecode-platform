import {
  Injectable,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  createWriteStream,
} from 'node:fs';

import {
  stat,
  unlink,
} from 'node:fs/promises';

import {
  join,
} from 'node:path';

import {
  Readable,
  Transform,
} from 'node:stream';

import {
  pipeline,
} from 'node:stream/promises';

import {
  GithubWorkerClientService,
} from './github-worker-client.service';

interface DownloadGithubRepositoryInput {
  installationId: string;

  owner: string;

  repositoryName: string;

  ref: string;

  workspacePath: string;
}

export interface RepositoryDownloadResult {
  archivePath: string;

  sizeBytes: number;
}

@Injectable()
export class RepositoryDownloadService {
  constructor(
    private readonly configService:
      ConfigService,

    private readonly githubClient:
      GithubWorkerClientService,
  ) {}

  async downloadGithubRepository(
    input: DownloadGithubRepositoryInput,
  ): Promise<RepositoryDownloadResult> {
    const maxSizeBytes =
      this.getMaximumRepositorySizeBytes();

    const token =
      await this.githubClient
        .createInstallationAccessToken(
          input.installationId,
        );

    const archivePath =
      join(
        input.workspacePath,
        'repository.zip',
      );

    const url =
      `https://api.github.com/repos/` +
      `${encodeURIComponent(input.owner)}/` +
      `${encodeURIComponent(input.repositoryName)}/` +
      `zipball/${encodeURIComponent(input.ref)}`;

    const controller =
      new AbortController();

    const timeoutSeconds =
      this.getDownloadTimeoutSeconds();

    const timeout =
      setTimeout(
        () => controller.abort(),
        timeoutSeconds * 1000,
      );

    try {
      const response =
        await fetch(
          url,
          {
            method: 'GET',

            headers:
              this.githubClient
                .createInstallationHeaders(
                  token,
                ),

            redirect:
              'follow',

            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        const responseBody =
          await response.text();

        throw new Error(
          `Téléchargement GitHub impossible HTTP ${response.status}: ${responseBody.slice(0, 300)}`,
        );
      }

      const contentLength =
        response.headers.get(
          'content-length',
        );

      if (contentLength) {
        const declaredSize =
          Number(contentLength);

        if (
          Number.isFinite(
            declaredSize,
          ) &&
          declaredSize >
            maxSizeBytes
        ) {
          throw new Error(
            `Repository trop volumineux : ${declaredSize} octets.`,
          );
        }
      }

      if (!response.body) {
        throw new Error(
          "GitHub n'a retourné aucun contenu.",
        );
      }

      let downloadedBytes =
        0;

      const sizeLimiter =
        new Transform({
          transform(
            chunk:
              Buffer,
            _encoding,
            callback,
          ) {
            downloadedBytes +=
              chunk.length;

            if (
              downloadedBytes >
              maxSizeBytes
            ) {
              callback(
                new Error(
                  'La taille maximale autorisée du repository a été dépassée.',
                ),
              );

              return;
            }

            callback(
              null,
              chunk,
            );
          },
        });

      const source =
        Readable.fromWeb(
          response.body as never,
        );

      await pipeline(
        source,
        sizeLimiter,
        createWriteStream(
          archivePath,
          {
            flags: 'wx',
          },
        ),
      );

      const archiveStat =
        await stat(
          archivePath,
        );

      if (
        archiveStat.size === 0
      ) {
        throw new Error(
          'Archive GitHub vide.',
        );
      }

      if (
        archiveStat.size >
        maxSizeBytes
      ) {
        throw new Error(
          'Archive GitHub supérieure à la limite autorisée.',
        );
      }

      return {
        archivePath,

        sizeBytes:
          archiveStat.size,
      };
    } catch (error) {
      try {
        await unlink(
          archivePath,
        );
      } catch {
        // Le fichier peut ne pas avoir
        // encore été créé.
      }

      throw error;
    } finally {
      clearTimeout(
        timeout,
      );
    }
  }

  private getMaximumRepositorySizeBytes():
    number {
    const configured =
      this.configService.get<string>(
        'SCANNER_MAX_REPOSITORY_SIZE_MB',
      );

    const maximumMb =
      Number(
        configured ?? 250,
      );

    if (
      !Number.isFinite(maximumMb) ||
      maximumMb <= 0
    ) {
      throw new Error(
        'SCANNER_MAX_REPOSITORY_SIZE_MB est invalide.',
      );
    }

    return Math.floor(
      maximumMb *
        1024 *
        1024,
    );
  }

  private getDownloadTimeoutSeconds():
    number {
    const configured =
      this.configService.get<string>(
        'SCANNER_TIMEOUT_SECONDS',
      );

    const seconds =
      Number(
        configured ?? 300,
      );

    if (
      !Number.isFinite(seconds) ||
      seconds <= 0
    ) {
      return 300;
    }

    return Math.floor(
      seconds,
    );
  }
}
