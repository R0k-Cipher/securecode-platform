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
  mkdir,
  rm,
} from 'node:fs/promises';

import {
  dirname,
  resolve,
  sep,
} from 'node:path';

import {
  Transform,
} from 'node:stream';

import {
  pipeline,
} from 'node:stream/promises';

import * as yauzl from 'yauzl';

export interface ExtractRepositoryArchiveInput {
  archivePath: string;
  workspacePath: string;
}

@Injectable()
export class RepositoryExtractionService {
  constructor(
    private readonly configService:
      ConfigService,
  ) {}

  async extractArchive(
    input: ExtractRepositoryArchiveInput,
  ): Promise<string> {
    const workspaceRoot =
      resolve(
        input.workspacePath,
      );

    const archivePath =
      resolve(
        input.archivePath,
      );

    this.assertInsideRoot(
      workspaceRoot,
      archivePath,
    );

    const sourceRoot =
      resolve(
        workspaceRoot,
        'source',
      );

    this.assertInsideRoot(
      workspaceRoot,
      sourceRoot,
    );

    await rm(
      sourceRoot,
      {
        recursive: true,
        force: true,
      },
    );

    await mkdir(
      sourceRoot,
      {
        recursive: true,
      },
    );

    try {
      await this.extractZip(
        archivePath,
        sourceRoot,
      );

      return sourceRoot;
    } catch (error) {
      /*
       * Une extraction partiellement terminée
       * ne doit jamais être réutilisée.
       */
      await rm(
        sourceRoot,
        {
          recursive: true,
          force: true,
        },
      );

      throw error;
    }
  }

  private async extractZip(
    archivePath: string,
    sourceRoot: string,
  ): Promise<void> {
    const maxFiles =
      this.getMaximumFileCount();

    const maxFileSize =
      this.getMaximumFileSizeBytes();

    const maxExtractedSize =
      this.getMaximumExtractedSizeBytes();

    const maxCompressionRatio =
      this.getMaximumCompressionRatio();

    const zipFile =
      await this.openZip(
        archivePath,
      );

    let fileCount =
      0;

    let actualExtractedSize =
      0;

    let rootPrefix:
      string | null = null;

    const extractedDestinations =
      new Set<string>();

    try {
      await new Promise<void>(
        (
          resolvePromise,
          rejectPromise,
        ) => {
          let settled =
            false;

          const fail =
            (error: unknown) => {
              if (settled) {
                return;
              }

              settled =
                true;

              try {
                zipFile.close();
              } catch {
                // Rien à faire.
              }

              rejectPromise(
                error instanceof Error
                  ? error
                  : new Error(
                      String(error),
                    ),
              );
            };

          const complete =
            () => {
              if (settled) {
                return;
              }

              settled =
                true;

              resolvePromise();
            };

          zipFile.on(
            'error',
            fail,
          );

          zipFile.on(
            'end',
            complete,
          );

          zipFile.on(
            'entry',
            async (
              entry:
                yauzl.Entry,
            ) => {
              try {
                const normalizedEntryName =
                  this.normalizeArchiveEntryName(
                    entry.fileName,
                  );

                if (
                  normalizedEntryName ===
                  null
                ) {
                  zipFile.readEntry();

                  return;
                }

                const pathParts =
                  normalizedEntryName
                    .split('/')
                    .filter(Boolean);

                /*
                 * Les archives GitHub zipball
                 * possèdent normalement un dossier
                 * racine du type :
                 *
                 * owner-repository-sha/
                 *
                 * Nous le retirons afin que :
                 *
                 * source/src/app.ts
                 *
                 * corresponde directement aux paths
                 * retournés par GitHub Compare API.
                 */
                if (!rootPrefix) {
                  rootPrefix =
                    pathParts[0] ??
                    null;
                }

                if (
                  !rootPrefix ||
                  pathParts[0] !==
                    rootPrefix
                ) {
                  throw new Error(
                    'Archive invalide : plusieurs racines ont été détectées.',
                  );
                }

                const strippedParts =
                  pathParts.slice(
                    1,
                  );

                /*
                 * Entrée correspondant uniquement
                 * au dossier racine GitHub.
                 */
                if (
                  strippedParts.length ===
                  0
                ) {
                  zipFile.readEntry();

                  return;
                }

                const relativePath =
                  strippedParts.join(
                    '/',
                  );

                this.assertSafeRelativePath(
                  relativePath,
                );

                const destination =
                  resolve(
                    sourceRoot,
                    ...strippedParts,
                  );

                this.assertInsideRoot(
                  sourceRoot,
                  destination,
                );

                /*
                 * Évite les collisions volontairement
                 * créées dans une archive malveillante.
                 */
                const destinationKey =
                  process.platform ===
                  'win32'
                    ? destination.toLowerCase()
                    : destination;

                if (
                  extractedDestinations.has(
                    destinationKey,
                  )
                ) {
                  throw new Error(
                    `Entrée ZIP dupliquée : ${relativePath}`,
                  );
                }

                extractedDestinations.add(
                  destinationKey,
                );

                const isDirectory =
                  normalizedEntryName.endsWith(
                    '/',
                  );

                if (
                  this.isSymbolicLink(
                    entry,
                  )
                ) {
                  throw new Error(
                    `Lien symbolique interdit dans l'archive : ${relativePath}`,
                  );
                }

                if (
                  this.isUnsupportedSpecialFile(
                    entry,
                  )
                ) {
                  throw new Error(
                    `Type de fichier ZIP non supporté : ${relativePath}`,
                  );
                }

                if (
                  isDirectory
                ) {
                  await mkdir(
                    destination,
                    {
                      recursive: true,
                    },
                  );

                  zipFile.readEntry();

                  return;
                }

                fileCount +=
                  1;

                if (
                  fileCount >
                  maxFiles
                ) {
                  throw new Error(
                    `Nombre maximal de fichiers dépassé (${maxFiles}).`,
                  );
                }

                if (
                  entry.uncompressedSize >
                  maxFileSize
                ) {
                  throw new Error(
                    `Fichier trop volumineux dans l'archive : ${relativePath}`,
                  );
                }

                if (
                  entry.uncompressedSize >
                  0 &&
                  entry.compressedSize >
                  0
                ) {
                  const compressionRatio =
                    entry.uncompressedSize /
                    entry.compressedSize;

                  if (
                    compressionRatio >
                    maxCompressionRatio
                  ) {
                    throw new Error(
                      `Ratio de compression suspect pour ${relativePath}.`,
                    );
                  }
                }

                if (
                  actualExtractedSize +
                    entry.uncompressedSize >
                  maxExtractedSize
                ) {
                  throw new Error(
                    'La taille totale extraite maximale serait dépassée.',
                  );
                }

                await mkdir(
                  dirname(
                    destination,
                  ),
                  {
                    recursive: true,
                  },
                );

                const readStream =
                  await this.openEntryStream(
                    zipFile,
                    entry,
                  );

                let entryBytes =
                  0;

                const limiter =
                  new Transform({
                    transform(
                      chunk:
                        Buffer,
                      _encoding,
                      callback,
                    ) {
                      entryBytes +=
                        chunk.length;

                      actualExtractedSize +=
                        chunk.length;

                      if (
                        entryBytes >
                        maxFileSize
                      ) {
                        callback(
                          new Error(
                            `Fichier extrait supérieur à la limite autorisée : ${relativePath}`,
                          ),
                        );

                        return;
                      }

                      if (
                        actualExtractedSize >
                        maxExtractedSize
                      ) {
                        callback(
                          new Error(
                            'La taille maximale totale extraite a été dépassée.',
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

                await pipeline(
                  readStream,
                  limiter,
                  createWriteStream(
                    destination,
                    {
                      flags:
                        'wx',

                      /*
                       * Aucun droit d'exécution.
                       */
                      mode:
                        0o600,
                    },
                  ),
                );

                zipFile.readEntry();
              } catch (error) {
                fail(
                  error,
                );
              }
            },
          );

          /*
           * lazyEntries = true :
           * une seule entrée est traitée à la fois.
           */
          zipFile.readEntry();
        },
      );
    } finally {
      try {
        zipFile.close();
      } catch {
        // ZIP déjà fermé.
      }
    }
  }

  private openZip(
    archivePath: string,
  ): Promise<yauzl.ZipFile> {
    return new Promise(
      (
        resolvePromise,
        rejectPromise,
      ) => {
        yauzl.open(
          archivePath,
          {
            lazyEntries:
              true,

            autoClose:
              false,

            /*
             * Empêche certaines entrées invalides
             * d'être silencieusement acceptées.
             */
            strictFileNames:
              true,

            validateEntrySizes:
              true,
          },
          (
            error,
            zipFile,
          ) => {
            if (
              error ||
              !zipFile
            ) {
              rejectPromise(
                error ??
                  new Error(
                    "Impossible d'ouvrir l'archive ZIP.",
                  ),
              );

              return;
            }

            resolvePromise(
              zipFile,
            );
          },
        );
      },
    );
  }

  private openEntryStream(
    zipFile:
      yauzl.ZipFile,

    entry:
      yauzl.Entry,
  ): Promise<NodeJS.ReadableStream> {
    return new Promise(
      (
        resolvePromise,
        rejectPromise,
      ) => {
        zipFile.openReadStream(
          entry,
          (
            error,
            stream,
          ) => {
            if (
              error ||
              !stream
            ) {
              rejectPromise(
                error ??
                  new Error(
                    `Impossible de lire ${entry.fileName}.`,
                  ),
              );

              return;
            }

            resolvePromise(
              stream,
            );
          },
        );
      },
    );
  }

  private normalizeArchiveEntryName(
    fileName: string,
  ): string | null {
    if (
      !fileName ||
      fileName.includes(
        '\0',
      )
    ) {
      throw new Error(
        'Nom de fichier ZIP invalide.',
      );
    }

    /*
     * Un backslash peut avoir une signification
     * de séparateur sous Windows.
     */
    const normalized =
      fileName.replace(/\\/g, '/')

    if (
      normalized.startsWith(
        '/',
      ) ||
      /^[A-Za-z]:\//.test(
        normalized,
      )
    ) {
      throw new Error(
        `Chemin absolu interdit dans l'archive : ${fileName}`,
      );
    }

    const parts =
      normalized
        .split('/')
        .filter(
          (
            part,
          ) =>
            part.length >
            0,
        );

    for (
      const part of parts
    ) {
      if (
        part ===
        '.' ||
        part ===
        '..'
      ) {
        throw new Error(
          `Path traversal détecté dans l'archive : ${fileName}`,
        );
      }
    }

    if (
      parts.length ===
      0
    ) {
      return null;
    }

    return (
      parts.join('/') +
      (
        normalized.endsWith(
          '/',
        )
          ? '/'
          : ''
      )
    );
  }

  private assertSafeRelativePath(
    relativePath: string,
  ): void {
    if (
      !relativePath ||
      relativePath.includes(
        '\0',
      )
    ) {
      throw new Error(
        'Chemin extrait invalide.',
      );
    }

    if (
      relativePath.startsWith(
        '/',
      ) ||
      /^[A-Za-z]:[\\/]/.test(
        relativePath,
      )
    ) {
      throw new Error(
        `Chemin absolu interdit : ${relativePath}`,
      );
    }

    const parts =
      relativePath
        .replace(/\\/g, '/')
        .split('/');

    if (
      parts.some(
        (part) =>
          part ===
            '..' ||
          part ===
            '.',
      )
    ) {
      throw new Error(
        `Path traversal interdit : ${relativePath}`,
      );
    }
  }

  private assertInsideRoot(
    root: string,
    candidate: string,
  ): void {
    const resolvedRoot =
      resolve(
        root,
      );

    const resolvedCandidate =
      resolve(
        candidate,
      );

    const rootPrefix =
      resolvedRoot.endsWith(
        sep,
      )
        ? resolvedRoot
        : `${resolvedRoot}${sep}`;

    const candidateForCompare =
      process.platform ===
      'win32'
        ? resolvedCandidate.toLowerCase()
        : resolvedCandidate;

    const rootForCompare =
      process.platform ===
      'win32'
        ? resolvedRoot.toLowerCase()
        : resolvedRoot;

    const prefixForCompare =
      process.platform ===
      'win32'
        ? rootPrefix.toLowerCase()
        : rootPrefix;

    if (
      candidateForCompare !==
        rootForCompare &&
      !candidateForCompare.startsWith(
        prefixForCompare,
      )
    ) {
      throw new Error(
        'Tentative d’écriture hors du workspace autorisé.',
      );
    }
  }

  private isSymbolicLink(
    entry: yauzl.Entry,
  ): boolean {
    /*
     * UNIX file mode stocké dans les 16 bits
     * supérieurs des external attributes.
     */
    const mode =
      (
        entry.externalFileAttributes >>>
        16
      ) &
      0xffff;

    const fileType =
      mode &
      0xf000;

    return (
      fileType ===
      0xa000
    );
  }

  private isUnsupportedSpecialFile(
    entry: yauzl.Entry,
  ): boolean {
    const mode =
      (
        entry.externalFileAttributes >>>
        16
      ) &
      0xffff;

    const fileType =
      mode &
      0xf000;

    /*
     * 0 : attribut non renseigné.
     * 0x8000 : fichier normal.
     * 0x4000 : dossier.
     */
    return (
      fileType !==
        0 &&
      fileType !==
        0x8000 &&
      fileType !==
        0x4000 &&
      fileType !==
        0xa000
    );
  }

  private getMaximumFileCount():
    number {
    return this.readPositiveInteger(
      'SCANNER_MAX_FILE_COUNT',
      100_000,
    );
  }

  private getMaximumFileSizeBytes():
    number {
    const mb =
      this.readPositiveNumber(
        'SCANNER_MAX_FILE_SIZE_MB',
        10,
      );

    return Math.floor(
      mb *
        1024 *
        1024,
    );
  }

  private getMaximumExtractedSizeBytes():
    number {
    /*
     * L'archive compressée et les données
     * réellement extraites sont deux limites
     * différentes.
     */
    const mb =
      this.readPositiveNumber(
        'SCANNER_MAX_EXTRACTED_SIZE_MB',
        1_000,
      );

    return Math.floor(
      mb *
        1024 *
        1024,
    );
  }

  private getMaximumCompressionRatio():
    number {
    return this.readPositiveNumber(
      'SCANNER_MAX_COMPRESSION_RATIO',
      100,
    );
  }

  private readPositiveInteger(
    name: string,
    fallback: number,
  ): number {
    const value =
      Number(
        this.configService
          .get<string>(
            name,
          ) ??
          fallback,
      );

    if (
      !Number.isFinite(
        value,
      ) ||
      value <= 0
    ) {
      return fallback;
    }

    return Math.floor(
      value,
    );
  }

  private readPositiveNumber(
    name: string,
    fallback: number,
  ): number {
    const value =
      Number(
        this.configService
          .get<string>(
            name,
          ) ??
          fallback,
      );

    if (
      !Number.isFinite(
        value,
      ) ||
      value <= 0
    ) {
      return fallback;
    }

    return value;
  }
}
