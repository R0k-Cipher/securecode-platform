import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import {
  randomUUID,
} from 'node:crypto';

import {
  AuditAction,
  ConnectionStatus,
  GitProvider,
  Prisma,
  RepositorySyncStatus,
  RepositorySyncTrigger,
  RepositoryVisibility,
} from '@prisma/client';

import {
  JOB_NAMES,
  QUEUE_NAMES,
} from '@securecode-platform/queue-contracts';

import type {
  RepositorySyncJobData,
} from '@securecode-platform/queue-contracts';

import * as jwt from 'jsonwebtoken';

import { PrismaService } from '@securecode-platform/database';


import type {
  GithubRepositoryImportResult,
} from './types/github-import-result.type';

import { GithubClientService } from './github-client.service';

import { RbacService } from '../rbac';
import { PERMISSION_CODES } from '../rbac/types/permission-code.type';

import { ImportGithubRepositoryDto } from './dto/import-github-repository.dto';

import type {
  GithubInstallation,
  GithubInstallationTokenResponse,
} from './types/github-installation.type';

interface ListRepositoriesInput {
  organizationId: string;
  gitConnectionId: string;
  userId: string;
  page: number;
  perPage: number;
  search?: string;
}

interface ImportRepositoryInput
  extends ImportGithubRepositoryDto {
  organizationId: string;
  projectId: string;
}

@Injectable()
export class GithubAppService {
  private readonly githubApiUrl =
    'https://api.github.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly githubClientService: GithubClientService,
    private readonly rbacService: RbacService,

    @InjectQueue(QUEUE_NAMES.REPOSITORY_SYNC,)
    private readonly repositorySyncQueue: Queue,
  ) {}

  /**
   * Générer l’URL d’installation GitHub App.
   */
  async createInstallationUrl(
    organizationId: string,
    projectId: string,
    currentUserId: string,
  ) {
    await this.ensureOrganizationMembership(
      organizationId,
      currentUserId,
    );

    await this.rbacService
      .requireOrganizationPermission(
        organizationId,
        currentUserId,
        PERMISSION_CODES.GIT_CONNECTION_CREATE,
      );

    await this.rbacService
      .requireProjectPermission(
        organizationId,
        projectId,
        currentUserId,
        PERMISSION_CODES.REPOSITORY_CREATE,
      );

    const project =
      await this.prisma.project.findFirst({
        where: {
          id:
            projectId,

          organizationId,
        },

        select: {
          id:
            true,
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable dans cette organisation.',
      );
    }

    /*
    * ============================================================
    * Connexion GitHub existante
    * ============================================================
    */

    const existingConnection =
      await this.prisma.gitConnection
        .findFirst({
          where: {
            organizationId,

            provider:
              GitProvider.GITHUB,

            status:
              ConnectionStatus.ACTIVE,

            installationId: {
              not:
                null,
            },
          },

          select: {
            id:
              true,

            installationId:
              true,
          },

          orderBy: {
            updatedAt:
              'desc',
          },
        });

    if (
      existingConnection
        ?.installationId
    ) {
      return {
        provider:
          GitProvider.GITHUB,

        alreadyConnected:
          true,

        connectionId:
          existingConnection.id,

        installationId:
          existingConnection.installationId,

        installationUrl:
          null,

        expiresInSeconds:
          0,
      };
    }

    /*
    * ============================================================
    * Nettoyage des demandes expirées
    * ============================================================
    */

    await this.prisma
      .githubInstallationPending
      .deleteMany({
        where: {
          expiresAt: {
            lte:
              new Date(),
          },
        },
      });

    /*
    * Une seule tentative active pour le même user.
    */

    await this.prisma
      .githubInstallationPending
      .deleteMany({
        where: {
          userId:
            currentUserId,
        },
      });

    /*
    * ============================================================
    * Créer le pending AVANT de générer l'URL.
    *
    * Son UUID devient le state GitHub.
    * ============================================================
    */

    const pending =
      await this.prisma
        .githubInstallationPending
        .create({
          data: {
            organizationId,

            projectId,

            userId:
              currentUserId,

            expiresAt:
              new Date(
                Date.now() +
                  10 *
                    60 *
                    1000,
              ),
          },

          select: {
            id:
              true,

            expiresAt:
              true,
          },
        });

    const appSlug =
      this.getRequiredConfig(
        'GITHUB_APP_SLUG',
      );

    const installationUrl =
      new URL(
        `https://github.com/apps/${encodeURIComponent(
          appSlug,
        )}/installations/new`,
      );

    /*
    * CRITIQUE :
    *
    * GitHub nous renverra ce state sur la Setup URL.
    * Le callback n'a donc plus besoin du JWT utilisateur.
    */

    installationUrl.searchParams.set(
      'state',
      pending.id,
    );

    return {
      provider:
        GitProvider.GITHUB,

      alreadyConnected:
        false,

      connectionId:
        null,

      installationId:
        null,

      installationUrl:
        installationUrl.toString(),

      state:
        pending.id,

      expiresAt:
        pending.expiresAt,

      expiresInSeconds:
        600,
    };
  }
  /**
   * Finaliser l’installation GitHub App.
   */
  async completeInstallation(
    installationId: string,
    state: string,
  ) {
    const normalizedInstallationId =
      installationId.trim();

    const normalizedState =
      state.trim();

    /*
    * ============================================================
    * 1. Validation basique du retour GitHub
    * ============================================================
    */

    if (
      !/^\d+$/.test(
        normalizedInstallationId,
      )
    ) {
      throw new BadRequestException(
        "L'identifiant d'installation GitHub est invalide.",
      );
    }

    if (!normalizedState) {
      throw new UnauthorizedException(
        "Le state GitHub est absent.",
      );
    }

    /*
    * ============================================================
    * 2. Résoudre le contexte depuis le state
    *
    * IMPORTANT :
    * le callback n'utilise PAS un JWT utilisateur.
    * ============================================================
    */

    const pending =
      await this.prisma
        .githubInstallationPending
        .findFirst({
          where: {
            id:
              normalizedState,

            expiresAt: {
              gt:
                new Date(),
            },
          },
        });

    if (!pending) {
      throw new UnauthorizedException(
        "Cette demande d'installation GitHub est invalide ou expirée.",
      );
    }

    const authenticatedUserId =
      pending.userId;

    const organizationId =
      pending.organizationId;

    /*
    * ============================================================
    * 3. Vérifier que le user d'origine possède toujours l'accès
    * ============================================================
    */

    await this.ensureOrganizationMembership(
      organizationId,
      authenticatedUserId,
    );

    await this.rbacService
      .requireOrganizationPermission(
        organizationId,
        authenticatedUserId,
        PERMISSION_CODES.GIT_CONNECTION_CREATE,
      );

    await this.rbacService
      .requireProjectPermission(
        organizationId,
        pending.projectId,
        authenticatedUserId,
        PERMISSION_CODES.REPOSITORY_CREATE,
      );

    /*
    * ============================================================
    * 4. Vérifier le projet
    * ============================================================
    */

    const project =
      await this.prisma.project.findFirst({
        where: {
          id:
            pending.projectId,

          organizationId,
        },

        select: {
          id:
            true,
        },
      });

    if (!project) {
      await this.prisma
        .githubInstallationPending
        .delete({
          where: {
            id:
              pending.id,
          },
        });

      throw new NotFoundException(
        'Le projet associé à cette installation est introuvable.',
      );
    }

    /*
    * ============================================================
    * 5. Vérifier réellement l'installation auprès de GitHub
    * ============================================================
    */

    const installation =
      await this.getInstallation(
        normalizedInstallationId,
      );

    const configuredAppId =
      Number(
        this.getRequiredConfig(
          'GITHUB_APP_ID',
        ),
      );

    if (
      !Number.isSafeInteger(
        configuredAppId,
      ) ||
      installation.app_id !==
        configuredAppId
    ) {
      throw new UnauthorizedException(
        "Cette installation n'appartient pas à la GitHub App SecureCode-AI.",
      );
    }

    if (
      installation.suspended_at
    ) {
      throw new ConflictException(
        "L'installation GitHub est suspendue.",
      );
    }

    /*
    * ============================================================
    * 6. Informations du compte GitHub
    * ============================================================
    */

    const externalAccountId =
      String(
        installation.account.id ??
          installation.target_id,
      );

    const externalAccountName =
      installation.account.login ??
      installation.account.name ??
      null;

    /*
    * ============================================================
    * 7. Enregistrer GitConnection de manière atomique
    * ============================================================
    */

    try {
      const connection =
        await this.prisma
          .$transaction(
            async (
              transaction,
            ) => {
              /*
              * Une installation GitHub ne doit jamais pouvoir
              * appartenir à deux tenants SecureCode différents.
              */

              const existingByInstallation =
                await transaction
                  .gitConnection
                  .findFirst({
                    where: {
                      provider:
                        GitProvider.GITHUB,

                      installationId:
                        normalizedInstallationId,
                    },

                    select: {
                      id:
                        true,

                      organizationId:
                        true,
                    },
                  });

              if (
                existingByInstallation &&
                existingByInstallation
                  .organizationId !==
                  organizationId
              ) {
                throw new ConflictException(
                  'Cette installation GitHub est déjà associée à une autre organisation.',
                );
              }

              const savedConnection =
                await transaction
                  .gitConnection
                  .upsert({
                    where: {
                      organizationId_provider_externalAccountId:
                        {
                          organizationId,

                          provider:
                            GitProvider.GITHUB,

                          externalAccountId,
                        },
                    },

                    create: {
                      organizationId,

                      connectedById:
                        authenticatedUserId,

                      provider:
                        GitProvider.GITHUB,

                      externalAccountId,

                      externalAccountName,

                      installationId:
                        normalizedInstallationId,

                      repositorySelection:
                        installation.repository_selection,

                      permissions:
                        installation.permissions,

                      status:
                        ConnectionStatus.ACTIVE,

                      revokedAt:
                        null,
                    },

                    update: {
                      connectedById:
                        authenticatedUserId,

                      externalAccountName,

                      installationId:
                        normalizedInstallationId,

                      repositorySelection:
                        installation.repository_selection,

                      permissions:
                        installation.permissions,

                      status:
                        ConnectionStatus.ACTIVE,

                      revokedAt:
                        null,
                    },

                    select: {
                      id:
                        true,

                      organizationId:
                        true,

                      provider:
                        true,

                      externalAccountId:
                        true,

                      externalAccountName:
                        true,

                      installationId:
                        true,

                      repositorySelection:
                        true,

                      permissions:
                        true,

                      status:
                        true,

                      createdAt:
                        true,

                      updatedAt:
                        true,
                    },
                  });

              /*
              * Audit.
              */

              await transaction
                .auditLog
                .create({
                  data: {
                    organizationId,

                    projectId:
                      pending.projectId,

                    actorId:
                      authenticatedUserId,

                    action:
                      AuditAction.CONNECT,

                    resourceType:
                      'GitConnection',

                    resourceId:
                      savedConnection.id,

                    description:
                      `Installation GitHub "${externalAccountName ?? externalAccountId}" connectée`,

                    metadata: {
                      installationId:
                        normalizedInstallationId,

                      repositorySelection:
                        installation.repository_selection,

                      accountType:
                        installation.target_type,
                    },
                  },
                });

              /*
              * Le state est à usage unique.
              */

              await transaction
                .githubInstallationPending
                .delete({
                  where: {
                    id:
                      pending.id,
                  },
                });

              return savedConnection;
            },
          );

      return {
        message:
          'GitHub App installée avec succès.',

        context: {
          organizationId,

          projectId:
            pending.projectId,
        },

        connection,
      };
    } catch (
      error: unknown
    ) {
      if (
        error instanceof
        ConflictException
      ) {
        throw error;
      }

      if (
        error instanceof
          Prisma
            .PrismaClientKnownRequestError &&
        error.code ===
          'P2002'
      ) {
        throw new ConflictException(
          'Cette installation GitHub est déjà enregistrée.',
        );
      }

      throw error;
    }
  }

  /**
   * Générer un token temporaire
   * pour l’installation GitHub.
   */
  async createInstallationAccessToken(
    organizationId: string,
    connectionId: string,
    currentUserId: string,
  ): Promise<GithubInstallationTokenResponse> {
    await this.ensureOrganizationMembership(
      organizationId,
      currentUserId,
    );

    await this.rbacService
      .requireOrganizationPermission(
        organizationId,
        currentUserId,
        PERMISSION_CODES.GIT_CONNECTION_READ,
      );

    const connection =
      await this.prisma.gitConnection.findFirst({
        where: {
          id: connectionId,
          organizationId,
          provider: GitProvider.GITHUB,
        },

        select: {
          installationId: true,
          status: true,
        },
      });

    if (!connection) {
      throw new NotFoundException(
        'Connexion GitHub introuvable.',
      );
    }

    if (
      connection.status !==
      ConnectionStatus.ACTIVE
    ) {
      throw new ConflictException(
        "La connexion GitHub n'est pas active.",
      );
    }

    if (!connection.installationId) {
      throw new ConflictException(
        "Cette connexion ne possède pas d'identifiant d'installation GitHub.",
      );
    }



    return this.requestInstallationAccessToken(
      connection.installationId,
    );
  }

  /**
   * Lister les repositories autorisés
   * pour une installation GitHub.
   */
  async listRepositories(
    input: ListRepositoriesInput,
  ) {
    await this.ensureOrganizationMembership(
      input.organizationId,
      input.userId,
    );

    await this.rbacService
      .requireOrganizationPermission(
        input.organizationId,
        input.userId,
        PERMISSION_CODES.GIT_CONNECTION_READ,
      );

    const connection =
      await this.prisma.gitConnection.findFirst({
        where: {
          id: input.gitConnectionId,
          organizationId:
            input.organizationId,
          provider: GitProvider.GITHUB,
        },

        select: {
          id: true,
          organizationId: true,
          provider: true,
          status: true,
          installationId: true,
        },
      });

    if (!connection) {
      throw new NotFoundException(
        'Connexion GitHub introuvable dans cette organisation.',
      );
    }

    if (
      connection.status !==
      ConnectionStatus.ACTIVE
    ) {
      throw new ConflictException(
        "La connexion GitHub n'est pas active.",
      );
    }

    if (!connection.installationId) {
      throw new ConflictException(
        "Cette connexion GitHub ne possède pas d'identifiant d'installation.",
      );
    }



    const page =
      Number.isInteger(input.page) &&
      input.page > 0
        ? input.page
        : 1;

    const perPage =
      Number.isInteger(input.perPage) &&
      input.perPage > 0
        ? Math.min(input.perPage, 100)
        : 30;

    const result =
      await this.githubClientService
        .listInstallationRepositories(
          Number(connection.installationId),
          page,
          perPage,
          input.search,
        );

    const installation =
      await this.getInstallation(
        connection.installationId,
      );

    const installationInfo = {
      id:
        String(
          installation.id,
        ),

      accountName:
        installation.account.login ??
        installation.account.name ??
        null,

      repositorySelection:
        installation.repository_selection,

      manageUrl:
        installation.html_url,
    };

    const externalRepositoryIds =
      result.items.map((repository) =>
        String(repository.id),
      );

    if (
      externalRepositoryIds.length === 0
    ) {
      return {
        ...result,

        installation : installationInfo,
      };
    }

    const importedRepositories =
      await this.prisma.repository.findMany({
        where: {
          organizationId:
            input.organizationId,

          gitConnectionId:
            connection.id,

          externalId: {
            in: externalRepositoryIds,
          },
        },

        select: {
          id: true,
          externalId: true,
          projectId: true,
          syncStatus: true,
        },
      });

    const importedByExternalId =
      new Map(
        importedRepositories.map(
          (repository) => [
            repository.externalId,
            repository,
          ],
        ),
      );

    return {
      ...result,

      installation:
        installationInfo,

      items:
        result.items.map(
          (repository) => {
            const imported =
              importedByExternalId.get(
                String(repository.id),
              );

            return {
              ...repository,

              imported:
                Boolean(imported),

              localRepositoryId:
                imported?.id ?? null,

              projectId:
                imported?.projectId ?? null,

              syncStatus:
                imported?.syncStatus ?? null,
            };
          },
        ),
    };
  }

  /**
   * Importer un repository GitHub
   * dans un projet local.
   */
  async importRepository(
    dto: ImportRepositoryInput,
    currentUserId: string,
  ): Promise<GithubRepositoryImportResult> {
    await this.ensureOrganizationMembership(
      dto.organizationId,
      currentUserId,
    );

    await this.rbacService
      .requireProjectPermission(
        dto.organizationId,
        dto.projectId,
        currentUserId,
        PERMISSION_CODES.REPOSITORY_CREATE,
      );

    await this.rbacService
      .requireOrganizationPermission(
        dto.organizationId,
        currentUserId,
        PERMISSION_CODES.GIT_CONNECTION_READ,
      );

    const [project, connection] =
      await Promise.all([
        this.prisma.project.findFirst({
          where: {
            id: dto.projectId,
            organizationId:
              dto.organizationId,
          },

          select: {
            id: true,
            organizationId: true,
          },
        }),

        this.prisma.gitConnection.findFirst({
          where: {
            id: dto.gitConnectionId,
            organizationId:
              dto.organizationId,
            provider:
              GitProvider.GITHUB,
          },

          select: {
            id: true,
            organizationId: true,
            installationId: true,
            status: true,
          },
        }),
      ]);

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable dans cette organisation.',
      );
    }

    if (!connection) {
      throw new NotFoundException(
        'Connexion GitHub introuvable dans cette organisation.',
      );
    }

    if (
      connection.status !==
      ConnectionStatus.ACTIVE
    ) {
      throw new ConflictException(
        "La connexion GitHub n'est pas active.",
      );
    }

    if (!connection.installationId) {
      throw new ConflictException(
        "La connexion GitHub ne possède pas d'identifiant d'installation.",
      );
    }

    const installationId = Number(
      connection.installationId,
    );

    if (!Number.isSafeInteger(installationId)) {
      throw new InternalServerErrorException(
        "L'identifiant d'installation GitHub enregistré est invalide.",
      );
    }

    const githubRepository =
      await this.githubClientService
        .getInstallationRepository(
          installationId,
          dto.githubRepositoryId,
        );

    if (githubRepository.archived) {
      throw new BadRequestException(
        'Un repository GitHub archivé ne peut pas être importé.',
      );
    }

    if (githubRepository.disabled) {
      throw new BadRequestException(
        'Un repository GitHub désactivé ne peut pas être importé.',
      );
    }

    const externalId =
      String(githubRepository.id);

    const existingRepository =
      await this.prisma.repository.findFirst({
        where: {
          organizationId:
            dto.organizationId,

          gitConnectionId:
            connection.id,

          externalId,
        },

        select: {
          id: true,
          projectId: true,
        },
      });

    if (existingRepository) {
      throw new ConflictException(
        existingRepository.projectId ===
          dto.projectId
          ? 'Ce repository GitHub est déjà importé dans ce projet.'
          : 'Ce repository GitHub est déjà associé à un autre projet de cette organisation.',
      );
    }

    const defaultBranch =
      githubRepository.defaultBranch ?? null;

    let latestCommitSha: string | null = null;

    if (defaultBranch) {
      const latestCommit =
        await this.githubClientService
          .getLatestCommit(
            installationId,
            githubRepository.owner.login,
            githubRepository.name,
            defaultBranch,
          );

      latestCommitSha =
        latestCommit.sha;
    }

    const triggerInitialSync =
      dto.triggerInitialSync ?? true;

    try {
      const transactionResult =
        await this.prisma.$transaction(
          async (transaction) => {
            const repository =
              await transaction.repository.create({
                data: {
                  organizationId:
                    dto.organizationId,

                  projectId:
                    dto.projectId,

                  gitConnectionId:
                    dto.gitConnectionId,

                  createdById:
                    currentUserId,

                  provider:
                    GitProvider.GITHUB,

                  externalId,

                  nodeId:
                    githubRepository.nodeId ?? null,

                  owner:
                    githubRepository.owner.login,

                  name:
                    githubRepository.name,

                  fullName:
                    githubRepository.fullName,

                  description:
                    githubRepository.description ?? null,

                  defaultBranch,

                  cloneUrl:
                    githubRepository.cloneUrl ?? null,

                  sshUrl:
                    githubRepository.sshUrl ?? null,

                  webUrl:
                    githubRepository.htmlUrl,

                  visibility:
                    githubRepository.private
                      ? RepositoryVisibility.PRIVATE
                      : RepositoryVisibility.PUBLIC,

                  isPrivate:
                    githubRepository.private,

                  isFork:
                    githubRepository.fork,

                  isArchived:
                    githubRepository.archived,

                  primaryLanguage:
                    githubRepository.language ?? null,

                  lastRemoteCommitSha:
                    latestCommitSha,

                  syncStatus:
                    triggerInitialSync && defaultBranch
                      ? RepositorySyncStatus.PENDING
                      : RepositorySyncStatus.NOT_SYNCED,
                },
              });

            const repositorySync =
              await transaction.repositorySync.create({
                data: {
                  repositoryId:
                    repository.id,

                  organizationId:
                    dto.organizationId,

                  triggeredById:
                    currentUserId,

                  status:
                    triggerInitialSync && defaultBranch
                      ? RepositorySyncStatus.PENDING
                      : RepositorySyncStatus.SKIPPED,

                  trigger:
                    RepositorySyncTrigger.INITIAL_IMPORT,

                  branch:
                    defaultBranch,

                  commitSha:
                    latestCommitSha,
                },
              });
            await transaction.auditLog.create({
              data: {
                organizationId:
                  dto.organizationId,

                actorId:
                  currentUserId,

                action:
                  AuditAction.CREATE,

                resourceType:
                  'Repository',

                resourceId:
                  repository.id,

                description:
                  `Repository GitHub "${githubRepository.fullName}" importé`,

                metadata: {
                  provider:
                    GitProvider.GITHUB,

                  externalId,

                  projectId:
                    dto.projectId,

                  gitConnectionId:
                    dto.gitConnectionId,

                  defaultBranch,

                  latestCommitSha,

                  initialSync:
                    triggerInitialSync,
                },
              },
            });

            return {
              repository,
              repositorySync,
            };
          },
        );

      let syncQueued = false;

      if (
        triggerInitialSync &&
        defaultBranch
      ) {
        const correlationId =
          randomUUID();

        const jobData: RepositorySyncJobData = {
          organizationId:
            dto.organizationId,

          projectId:
            dto.projectId,

          repositoryId:
            transactionResult.repository.id,

          repositorySyncId:
            transactionResult.repositorySync.id,

          gitConnectionId:
            dto.gitConnectionId,

          provider:
            'GITHUB',

          repositoryExternalId:
            externalId,

          repositoryFullName:
            githubRepository.fullName,

          branch:
            defaultBranch,

          commitSha:
            latestCommitSha,

          trigger:
            'INITIAL_IMPORT',

          eventType:
            null,

          eventId:
            null,

          triggeredById:
            currentUserId,

          requestedAt:
            new Date().toISOString(),

          correlationId,
        };

        try {
          const job =
            await this.repositorySyncQueue.add(
              JOB_NAMES.SYNC_REPOSITORY,
              jobData,
              {
                jobId: `repository-sync-${transactionResult.repositorySync.id}`,

                attempts: 3,

                backoff: {
                  type: 'exponential',
                  delay: 5_000,
                },

                removeOnComplete: 100,

                removeOnFail: 500,
              },
            );

          syncQueued = true;

          await this.prisma.repositorySync.update({
            where: {
              id:
                transactionResult.repositorySync.id,
            },

            data: {
              status:
                RepositorySyncStatus.QUEUED,

              queueJobId:
                job.id
                  ? String(job.id)
                  : null,

              metadata: {
                provider:
                  'GITHUB',

                repositoryFullName:
                  githubRepository.fullName,

                correlationId,
              },
            },
          });

          await this.prisma.repository.update({
            where: {
              id:
                transactionResult.repository.id,
            },

            data: {
              syncStatus:
                RepositorySyncStatus.QUEUED,
            },
          });
        } catch (queueError: unknown) {
          const safeMessage =
            queueError instanceof Error
              ? queueError.message.slice(0, 2000)
              : "Impossible d'ajouter la synchronisation à la file.";

          await this.prisma.$transaction([
            this.prisma.repository.update({
              where: {
                id:
                  transactionResult.repository.id,
              },

              data: {
                syncStatus:
                  RepositorySyncStatus.FAILED,
              },
            }),

            this.prisma.repositorySync.update({
              where: {
                id:
                  transactionResult.repositorySync.id,
              },

              data: {
                status:
                  RepositorySyncStatus.FAILED,

                failedAt:
                  new Date(),

                errorMessage:
                  safeMessage,
              },
            }),
          ]);

          throw new InternalServerErrorException(
            "Le repository a été importé, mais la synchronisation n'a pas pu être planifiée.",
          );
        }
      }

      return {
        repositoryId:
          transactionResult.repository.id,

        repositorySyncId:
          transactionResult.repositorySync.id,

        projectId:
          dto.projectId,

        gitConnectionId:
          dto.gitConnectionId,

        provider:
          'GITHUB',

        externalRepositoryId:
          externalId,

        fullName:
          githubRepository.fullName,

        defaultBranch,

        latestCommitSha,

        created:
          true,

        syncQueued,
      };
    } catch (error: unknown) {
      if (
        error instanceof
          BadRequestException ||
        error instanceof
          ConflictException ||
        error instanceof
          NotFoundException ||
        error instanceof
          InternalServerErrorException
      ) {
        throw error;
      }

      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Ce repository GitHub est déjà importé.',
        );
      }

      throw error;
    }
  }

  /**
   * Demander directement un token
   * d’installation à GitHub.
   */
  private async requestInstallationAccessToken(
    installationId: string,
  ): Promise<GithubInstallationTokenResponse> {
    const appJwt =
      this.generateAppJwt();

    const response = await fetch(
      `${this.githubApiUrl}/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',

        headers:
          this.createGithubHeaders(
            appJwt,
          ),
      },
    );

    if (!response.ok) {
      const body =
        await response.text();

      throw new BadGatewayException({
        message:
          "GitHub n'a pas pu générer le jeton d'installation.",

        githubStatus:
          response.status,

        githubResponse:
          body.slice(0, 500),
      });
    }

    return (
      await response.json()
    ) as GithubInstallationTokenResponse;
  }

  /**
   * Récupérer les informations
   * d’une installation GitHub.
   */
  private async getInstallation(
    installationId: string,
  ): Promise<GithubInstallation> {
    const appJwt =
      this.generateAppJwt();

    const response = await fetch(
      `${this.githubApiUrl}/app/installations/${installationId}`,
      {
        method: 'GET',

        headers:
          this.createGithubHeaders(
            appJwt,
          ),
      },
    );

    if (response.status === 404) {
      throw new NotFoundException(
        'Installation GitHub introuvable.',
      );
    }

    if (!response.ok) {
      const body =
        await response.text();

      throw new BadGatewayException({
        message:
          "Impossible de vérifier l'installation auprès de GitHub.",

        githubStatus:
          response.status,

        githubResponse:
          body.slice(0, 500),
      });
    }

    return (
      await response.json()
    ) as GithubInstallation;
  }

  /**
   * Générer le JWT signé de la GitHub App.
   */
  private generateAppJwt(): string {
    const appId =
      this.getRequiredConfig(
        'GITHUB_APP_ID',
      );

    const privateKeyBase64 =
      this.getRequiredConfig(
        'GITHUB_APP_PRIVATE_KEY_BASE64',
      );

    let privateKey: string;

    try {
      privateKey = Buffer.from(
        privateKeyBase64,
        'base64',
      ).toString('utf8');
    } catch {
      throw new InternalServerErrorException(
        'La clé privée GitHub App est invalide.',
      );
    }

    if (
      !privateKey.includes(
        'BEGIN',
      )
    ) {
      throw new InternalServerErrorException(
        'La clé privée GitHub App décodée ne semble pas être une clé PEM valide.',
      );
    }

    const now = Math.floor(
      Date.now() / 1000,
    );

    try {
      return jwt.sign(
        {
          iat: now - 60,
          exp: now + 9 * 60,
          iss: appId,
        },
        privateKey,
        {
          algorithm: 'RS256',
        },
      );
    } catch {
      throw new InternalServerErrorException(
        "Impossible de signer le JWT de la GitHub App.",
      );
    }
  }

  /**
   * Construire les headers GitHub.
   */
  private createGithubHeaders(
    token: string,
  ): Record<string, string> {
    return {
      Accept:
        'application/vnd.github+json',

      Authorization:
        `Bearer ${token}`,

      'X-GitHub-Api-Version':
        this.configService.get<string>(
          'GITHUB_API_VERSION',
        ) ?? '2022-11-28',

      'User-Agent':
        'SecureCode-AI',
    };
  }


  private async ensureOrganizationMembership(
    organizationId: string,
    userId: string,
  ) {
    const membership =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },

        select: {
          id: true,
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de cette organisation.",
      );
    }

    return membership;
  }


  /**
   * Récupérer une variable obligatoire.
   */
  private getRequiredConfig(
    name: string,
  ): string {
    const value =
      this.configService.get<string>(
        name,
      );

    if (
      !value ||
      value.trim().length === 0
    ) {
      throw new InternalServerErrorException(
        `La variable ${name} est manquante.`,
      );
    }

    return value.trim();
  }
}
