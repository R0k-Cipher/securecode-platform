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
  AuditAction,
  ConnectionStatus,
  GitProvider,
  Prisma,
  RepositorySyncStatus,
  RepositorySyncTrigger,
  RepositoryVisibility,
} from '@prisma/client';

import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import * as jwt from 'jsonwebtoken';

import { PrismaService } from '@securecode-platform/database';

import type {
  GithubInstallation,
  GithubInstallationState,
  GithubInstallationTokenResponse,
} from './types/github-installation.type';

import type {
  GithubRepositoryImportResult,
} from './types/github-import-result.type';

import { GithubClientService } from './github-client.service';

import { RbacService } from '../rbac';
import { PERMISSION_CODES } from '../rbac/types/permission-code.type';

import { ImportGithubRepositoryDto } from './dto/import-github-repository.dto';

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

    @InjectQueue('repository-sync')
    private readonly repositorySyncQueue: Queue,
  ) {}

  /**
   * Générer l’URL d’installation GitHub App.
   */
  async createInstallationUrl(
    organizationId: string,
    currentUserId: string,
  ) {
    await this.ensureOrganizationMembership(
      organizationId,
      currentUserId,
    );

    await this.rbacService.requirePermission(
      currentUserId,
      organizationId,
      PERMISSION_CODES.GIT_CONNECTION_CREATE,
    );

    const appSlug = this.getRequiredConfig(
      'GITHUB_APP_SLUG',
    );

    const state = this.createInstallationState({
      organizationId,
      userId: currentUserId,
      expiresAt: Date.now() + 10 * 60 * 1000,
      nonce: randomBytes(24).toString('hex'),
    });

    const installationUrl = new URL(
      `https://github.com/apps/${encodeURIComponent(
        appSlug,
      )}/installations/new`,
    );

    installationUrl.searchParams.set(
      'state',
      state,
    );

    return {
      provider: GitProvider.GITHUB,
      installationUrl:
        installationUrl.toString(),
      expiresInSeconds: 600,
    };
  }

  /**
   * Finaliser l’installation GitHub App.
   */
  async completeInstallation(
    installationId: string,
    state: string,
    authenticatedUserId: string,
  ) {
    const statePayload =
      this.verifyInstallationState(state);

    if (
      statePayload.userId !== authenticatedUserId
    ) {
      throw new ForbiddenException(
        "Cette installation GitHub n'appartient pas à votre session.",
      );
    }

    await this.ensureOrganizationMembership(
      statePayload.organizationId,
      authenticatedUserId,
    );

    await this.rbacService.requirePermission(
      authenticatedUserId,
      statePayload.organizationId,
      PERMISSION_CODES.GIT_CONNECTION_CREATE,
    );

    const normalizedInstallationId =
      installationId.trim();

    if (!/^\d+$/.test(normalizedInstallationId)) {
      throw new BadRequestException(
        "L'identifiant d'installation GitHub est invalide.",
      );
    }

    const installation =
      await this.getInstallation(
        normalizedInstallationId,
      );

    const configuredAppId = Number(
      this.getRequiredConfig('GITHUB_APP_ID'),
    );

    if (
      !Number.isFinite(configuredAppId) ||
      installation.app_id !== configuredAppId
    ) {
      throw new UnauthorizedException(
        "Cette installation n'appartient pas à la GitHub App SecureCode-AI.",
      );
    }

    if (installation.suspended_at) {
      throw new ConflictException(
        "L'installation GitHub est suspendue.",
      );
    }

    const externalAccountId = String(
      installation.account.id ??
        installation.target_id,
    );

    const externalAccountName =
      installation.account.login ??
      installation.account.name ??
      null;

    try {
      const connection =
        await this.prisma.$transaction(
          async (transaction) => {
            const existingByInstallation =
              await transaction.gitConnection.findFirst({
                where: {
                  provider: GitProvider.GITHUB,
                  installationId:
                    normalizedInstallationId,
                },
              });

            if (
              existingByInstallation &&
              existingByInstallation.organizationId !==
                statePayload.organizationId
            ) {
              throw new ConflictException(
                'Cette installation GitHub est déjà associée à une autre organisation.',
              );
            }

            const savedConnection =
              await transaction.gitConnection.upsert({
                where: {
                  organizationId_provider_externalAccountId:
                    {
                      organizationId:
                        statePayload.organizationId,
                      provider:
                        GitProvider.GITHUB,
                      externalAccountId,
                    },
                },

                create: {
                  organizationId:
                    statePayload.organizationId,

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

                  revokedAt: null,
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

                  revokedAt: null,
                },

                select: {
                  id: true,
                  organizationId: true,
                  provider: true,
                  externalAccountId: true,
                  externalAccountName: true,
                  installationId: true,
                  repositorySelection: true,
                  permissions: true,
                  status: true,
                  createdAt: true,
                  updatedAt: true,
                },
              });

            await transaction.auditLog.create({
              data: {
                organizationId:
                  statePayload.organizationId,

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

            return savedConnection;
          },
        );

      return {
        message:
          'GitHub App installée avec succès.',
        connection,
      };
    } catch (error: unknown) {
      if (
        error instanceof ConflictException
      ) {
        throw error;
      }

      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
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

    await this.rbacService.requirePermission(
      currentUserId,
      organizationId,
      PERMISSION_CODES.REPOSITORY_SYNC,
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

    await this.rbacService.requirePermission(
      input.userId,
      input.organizationId,
      PERMISSION_CODES.PROJECT_READ,
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

    const externalRepositoryIds =
      result.items.map((repository) =>
        String(repository.id),
      );

    if (
      externalRepositoryIds.length === 0
    ) {
      return result;
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

      items: result.items.map(
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

    await this.rbacService.requirePermission(
      currentUserId,
      dto.organizationId,
      PERMISSION_CODES.PROJECT_UPDATE,
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
        'Ce repository GitHub est déjà importé.',
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
        try {
          await this.repositorySyncQueue.add(
            'initial-repository-sync',

            {
              repositoryId:
                transactionResult.repository.id,

              repositorySyncId:
                transactionResult.repositorySync.id,

              organizationId:
                dto.organizationId,

              projectId:
                dto.projectId,

              gitConnectionId:
                dto.gitConnectionId,

              branch:
                defaultBranch,

              commitSha:
                latestCommitSha,

              triggeredById:
                currentUserId,
            },

            {
              jobId:
                `repository-initial-sync:${transactionResult.repository.id}`,

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
        } catch (queueError) {
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
                status: 'FAILED',

                errorMessage:
                  queueError instanceof Error
                    ? queueError.message
                    : "Impossible d'ajouter la synchronisation à la file.",
              },
            }),
          ]);

          throw new InternalServerErrorException(
            "Le repository a été créé, mais sa synchronisation n'a pas pu être ajoutée à la file.",
          );
        }
      }

      return {
        repositoryId:
          transactionResult.repository.id,

        projectId:
          dto.projectId,

        gitConnectionId:
          dto.gitConnectionId,

        provider: 'GITHUB',

        externalRepositoryId:
          externalId,

        fullName:
          githubRepository.fullName,

        defaultBranch,

        latestCommitSha,

        created: true,

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

  /**
   * Créer le state signé.
   */
  private createInstallationState(
    payload: GithubInstallationState,
  ): string {
    const encodedPayload =
      Buffer.from(
        JSON.stringify(payload),
        'utf8',
      ).toString('base64url');

    const signature = createHmac(
      'sha256',
      this.getStateSecret(),
    )
      .update(encodedPayload)
      .digest('base64url');

    return `${encodedPayload}.${signature}`;
  }

  /**
   * Vérifier le state signé.
   */
  private verifyInstallationState(
    state: string,
  ): GithubInstallationState {
    const parts =
      state.split('.');

    if (parts.length !== 2) {
      throw new UnauthorizedException(
        "L'état GitHub est invalide.",
      );
    }

    const [
      encodedPayload,
      receivedSignature,
    ] = parts;

    if (
      !encodedPayload ||
      !receivedSignature
    ) {
      throw new UnauthorizedException(
        "L'état GitHub est invalide.",
      );
    }

    const expectedSignature =
      createHmac(
        'sha256',
        this.getStateSecret(),
      )
        .update(encodedPayload)
        .digest('base64url');

    const receivedBuffer =
      Buffer.from(
        receivedSignature,
        'utf8',
      );

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        'utf8',
      );

    if (
      receivedBuffer.length !==
        expectedBuffer.length ||
      !timingSafeEqual(
        receivedBuffer,
        expectedBuffer,
      )
    ) {
      throw new UnauthorizedException(
        "La signature de l'état GitHub est invalide.",
      );
    }

    let payload:
      GithubInstallationState;

    try {
      payload = JSON.parse(
        Buffer.from(
          encodedPayload,
          'base64url',
        ).toString('utf8'),
      ) as GithubInstallationState;
    } catch {
      throw new UnauthorizedException(
        "Le contenu de l'état GitHub est invalide.",
      );
    }

    if (
      !payload.organizationId ||
      !payload.userId ||
      !payload.expiresAt ||
      !payload.nonce
    ) {
      throw new UnauthorizedException(
        "L'état GitHub est incomplet.",
      );
    }

    if (
      typeof payload.expiresAt !==
      'number'
    ) {
      throw new UnauthorizedException(
        "La date d'expiration du state GitHub est invalide.",
      );
    }

    if (
      payload.expiresAt <
      Date.now()
    ) {
      throw new UnauthorizedException(
        "L'état GitHub a expiré.",
      );
    }

    return payload;
  }

  /**
   * Vérifier que l’utilisateur est membre
   * de l’organisation.
   */
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
   * Récupérer le secret du state.
   */
  private getStateSecret(): string {
    return (
      this.configService.get<string>(
        'GITHUB_STATE_SECRET',
      ) ??
      this.getRequiredConfig(
        'JWT_ACCESS_SECRET',
      )
    );
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
