import {
  Injectable,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  createHash,
} from 'node:crypto';

import {
  createReadStream,
} from 'node:fs';

import {
  lstat,
  opendir,
  readFile,
} from 'node:fs/promises';

import {
  extname,
  relative,
  resolve,
  sep,
} from 'node:path';

import type {
  FileInventory,
  FileInventoryEntry,
} from '@securecode-platform/scanner-core';

import {
  LanguageDetector,
} from '@securecode-platform/scanner-core';

const IGNORED_DIRECTORIES =
  new Set([
    '.git',
    'node_modules',
    'vendor',
    'dist',
    'build',
    'coverage',
    '.next',
    '.nuxt',
    'target',
    'bin',
    'obj',
    '.idea',
    '.vscode',
  ]);



@Injectable()
export class FileDiscoveryService {

  private readonly languageDetector =
    new LanguageDetector();

  constructor(
    private readonly configService:
      ConfigService,
  ) {}

  async discover(
    workspacePath: string,
  ): Promise<FileInventory> {
    const root =
      resolve(
        workspacePath,
      );

    const maxFileSizeBytes =
      this.getMaximumFileSizeBytes();

    const maxFiles =
      this.getMaximumFileCount();

    const files:
      FileInventoryEntry[] = [];

    let totalSizeBytes =
      0;

    let skippedFiles =
      0;

    let ignoredFiles =
      0;

    const walk =
      async (
        currentDirectory:
          string,
      ): Promise<void> => {
        const directory =
          await opendir(
            currentDirectory,
          );

        for await (
          const entry of directory
        ) {
          const absolutePath =
            resolve(
              currentDirectory,
              entry.name,
            );

          this.assertInsideRoot(
            root,
            absolutePath,
          );

          const relativePath =
            this.normalizeRelativePath(
              relative(
                root,
                absolutePath,
              ),
            );

          if (
            entry.isDirectory()
          ) {
            if (
              IGNORED_DIRECTORIES.has(
                entry.name,
              )
            ) {
              ignoredFiles +=
                1;

              continue;
            }

            await walk(
              absolutePath,
            );

            continue;
          }

          if (
            entry.isSymbolicLink()
          ) {
            skippedFiles +=
              1;

            continue;
          }

          if (
            !entry.isFile()
          ) {
            skippedFiles +=
              1;

            continue;
          }

          const stats =
            await lstat(
              absolutePath,
            );

          if (
            stats.size >
            maxFileSizeBytes
          ) {
            skippedFiles +=
              1;

            continue;
          }

          if (
            files.length >=
            maxFiles
          ) {
            throw new Error(
              `Nombre maximal de fichiers dépassé (${maxFiles}).`,
            );
          }

          const isBinary =
            await this.isBinaryFile(
              absolutePath,
            );

          const sha256 =
            await this.calculateSha256(
              absolutePath,
            );

          files.push({
            relativePath,

            absolutePath,

            sizeBytes:
              stats.size,

            extension:
              extname(
                entry.name,
              )
                .toLowerCase(),

            sha256,

            isBinary,

            language:
              this.languageDetector
                .detect(
                  relativePath,
                )
                .language,
          });

          totalSizeBytes +=
            stats.size;
        }
      };

    await walk(
      root,
    );

    return {
      files,

      totalFiles:
        files.length,

      totalSizeBytes,

      skippedFiles,

      ignoredFiles,
    };
  }

  private async calculateSha256(
    filePath: string,
  ): Promise<string> {
    return new Promise(
      (
        resolvePromise,
        rejectPromise,
      ) => {
        const hash =
          createHash(
            'sha256',
          );

        const stream =
          createReadStream(
            filePath,
          );

        stream.on(
          'data',
          (chunk) => {
            hash.update(
              chunk,
            );
          },
        );

        stream.on(
          'error',
          rejectPromise,
        );

        stream.on(
          'end',
          () => {
            resolvePromise(
              hash.digest(
                'hex',
              ),
            );
          },
        );
      },
    );
  }

  private async isBinaryFile(
    filePath: string,
  ): Promise<boolean> {
    const file =
      await readFile(
        filePath,
      );

    const sample =
      file.subarray(
        0,
        Math.min(
          file.length,
          8_192,
        ),
      );

    for (
      const byte of sample
    ) {
      if (
        byte === 0
      ) {
        return true;
      }
    }

    return false;
  }

  private normalizeRelativePath(
    value: string,
  ): string {
    return value
      .split(
        sep,
      )
      .join('/');
  }

  private assertInsideRoot(
    root: string,
    candidate: string,
  ): void {
    const normalizedRoot =
      root.endsWith(
        sep,
      )
        ? root
        : `${root}${sep}`;

    const normalizedCandidate =
      resolve(
        candidate,
      );

    if (
      normalizedCandidate !==
        root &&
      !normalizedCandidate.startsWith(
        normalizedRoot,
      )
    ) {
      throw new Error(
        'Chemin détecté hors du workspace.',
      );
    }
  }

  private getMaximumFileSizeBytes():
    number {
    const configured =
      Number(
        this.configService.get<string>(
          'SCANNER_MAX_FILE_SIZE_MB',
        ) ?? 10,
      );

    return Math.floor(
      configured *
        1024 *
        1024,
    );
  }

  private getMaximumFileCount():
    number {
    const configured =
      Number(
        this.configService.get<string>(
          'SCANNER_MAX_FILE_COUNT',
        ) ??
          100_000,
      );

    if (
      !Number.isFinite(
        configured,
      ) ||
      configured <= 0
    ) {
      return 100_000;
    }

    return Math.floor(
      configured,
    );
  }
}
