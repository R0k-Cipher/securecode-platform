import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ConnectionStatus,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '@securecode-platform/database';

import { CreateGitConnectionDto } from './dto/create-git-connection.dto';
import { GitConnectionQueryDto } from './dto/git-connection-query.dto';
import { UpdateGitConnectionDto } from './dto/update-git-connection.dto';
import {
  GIT_CONNECTION_RESPONSE_INCLUDE,
  GitConnectionMapper,
} from './mappers/git-connection.mapper';

@Injectable()
export class GitConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    organizationId: string,
    currentUserId: string,
    dto: CreateGitConnectionDto,
  ) {
    await this.ensureOrganizationExists(
      organizationId,
    );

    const externalAccountId =
      dto.externalAccountId.trim();

    const duplicate =
      await this.prisma.gitConnection.findUnique({
        where: {
          organizationId_provider_externalAccountId: {
            organizationId,
            provider: dto.provider,
            externalAccountId,
          },
        },
        select: {
          id: true,
        },
      });

    if (duplicate) {
      throw new ConflictException(
        'Ce compte Git est déjà connecté à cette organisation.',
      );
    }

    const tokenExpiresAt = this.parseOptionalDate(
      dto.tokenExpiresAt,
    );

    try {
      const connection =
        await this.prisma.$transaction(
          async (transaction) => {
            const createdConnection =
              await transaction.gitConnection.create({
                data: {
                  organizationId,
                  connectedById: currentUserId,
                  provider: dto.provider,
                  externalAccountId,
                  externalAccountName:
                    this.normalizeOptionalText(
                      dto.externalAccountName,
                    ),
                  encryptedAccessToken:
                    dto.encryptedAccessToken.trim(),
                  encryptedRefreshToken:
                    this.normalizeOptionalText(
                      dto.encryptedRefreshToken,
                    ),
                  tokenExpiresAt,
                  status: ConnectionStatus.ACTIVE,
                },
                include:
                  GIT_CONNECTION_RESPONSE_INCLUDE,
              });

            await transaction.auditLog.create({
              data: {
                organizationId,
                actorId: currentUserId,
                action: AuditAction.CONNECT,
                resourceType: 'GitConnection',
                resourceId: createdConnection.id,
                description: `Connexion ${createdConnection.provider} ajoutée`,
                metadata: {
                  provider:
                    createdConnection.provider,
                  externalAccountId:
                    createdConnection.externalAccountId,
                  externalAccountName:
                    createdConnection.externalAccountName,
                },
              },
            });

            return createdConnection;
          },
        );

      return GitConnectionMapper.withRelations(
        connection,
      );
    } catch (error: unknown) {
      this.handlePrismaConflict(error);
      throw error;
    }
  }

  async findAll(
    organizationId: string,
    query: GitConnectionQueryDto,
  ) {
    await this.ensureOrganizationExists(
      organizationId,
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.GitConnectionWhereInput = {
      organizationId,

      ...(query.provider
        ? {
            provider: query.provider,
          }
        : {}),

      ...(query.status
        ? {
            status: query.status,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                externalAccountId: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                externalAccountName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [connections, total] =
      await this.prisma.$transaction([
        this.prisma.gitConnection.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            updatedAt: 'desc',
          },
          include:
            GIT_CONNECTION_RESPONSE_INCLUDE,
        }),

        this.prisma.gitConnection.count({
          where,
        }),
      ]);

    return {
      data: connections.map((connection) =>
        GitConnectionMapper.withRelations(
          connection,
        ),
      ),

      meta: {
        page,
        limit,
        total,
        totalPages:
          total === 0
            ? 0
            : Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(
    organizationId: string,
    connectionId: string,
  ) {
    const connection =
      await this.prisma.gitConnection.findFirst({
        where: {
          id: connectionId,
          organizationId,
        },
        include:
          GIT_CONNECTION_RESPONSE_INCLUDE,
      });

    if (!connection) {
      throw new NotFoundException(
        'Connexion Git introuvable.',
      );
    }

    return GitConnectionMapper.withRelations(
      connection,
    );
  }

  async update(
    organizationId: string,
    connectionId: string,
    currentUserId: string,
    dto: UpdateGitConnectionDto,
  ) {
    const existingConnection =
      await this.ensureConnectionExists(
        organizationId,
        connectionId,
      );

    if (
      existingConnection.status ===
      ConnectionStatus.REVOKED
    ) {
      throw new ConflictException(
        'Une connexion révoquée ne peut pas être modifiée.',
      );
    }

    const tokenExpiresAt =
      dto.tokenExpiresAt !== undefined
        ? this.parseOptionalDate(
            dto.tokenExpiresAt,
          )
        : undefined;

    const connection =
      await this.prisma.$transaction(
        async (transaction) => {
          const updatedConnection =
            await transaction.gitConnection.update({
              where: {
                id: connectionId,
              },
              data: {
                ...(dto.externalAccountName !==
                undefined
                  ? {
                      externalAccountName:
                        this.normalizeOptionalText(
                          dto.externalAccountName,
                        ),
                    }
                  : {}),

                ...(dto.encryptedAccessToken !==
                undefined
                  ? {
                      encryptedAccessToken:
                        dto.encryptedAccessToken.trim(),
                    }
                  : {}),

                ...(dto.encryptedRefreshToken !==
                undefined
                  ? {
                      encryptedRefreshToken:
                        this.normalizeOptionalText(
                          dto.encryptedRefreshToken,
                        ),
                    }
                  : {}),

                ...(tokenExpiresAt !== undefined
                  ? {
                      tokenExpiresAt,
                    }
                  : {}),

                ...(dto.status !== undefined
                  ? {
                      status: dto.status,
                      revokedAt:
                        dto.status ===
                        ConnectionStatus.REVOKED
                          ? new Date()
                          : null,
                    }
                  : {}),
              },
              include:
                GIT_CONNECTION_RESPONSE_INCLUDE,
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              actorId: currentUserId,
              action: AuditAction.UPDATE,
              resourceType: 'GitConnection',
              resourceId: connectionId,
              description: `Connexion ${updatedConnection.provider} modifiée`,
              metadata: {
                updatedFields:
                  Object.keys(dto),
                previousStatus:
                  existingConnection.status,
                newStatus:
                  updatedConnection.status,
              },
            },
          });

          return updatedConnection;
        },
      );

    return GitConnectionMapper.withRelations(
      connection,
    );
  }

  async revoke(
    organizationId: string,
    connectionId: string,
    currentUserId: string,
  ) {
    const existingConnection =
      await this.ensureConnectionExists(
        organizationId,
        connectionId,
      );

    if (
      existingConnection.status ===
      ConnectionStatus.REVOKED
    ) {
      throw new ConflictException(
        'Cette connexion Git est déjà révoquée.',
      );
    }

    const connection =
      await this.prisma.$transaction(
        async (transaction) => {
          const revokedConnection =
            await transaction.gitConnection.update({
              where: {
                id: connectionId,
              },
              data: {
                status: ConnectionStatus.REVOKED,
                revokedAt: new Date(),
              },
              include:
                GIT_CONNECTION_RESPONSE_INCLUDE,
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              actorId: currentUserId,
              action: AuditAction.DISCONNECT,
              resourceType: 'GitConnection',
              resourceId: connectionId,
              description: `Connexion ${revokedConnection.provider} révoquée`,
              metadata: {
                provider:
                  revokedConnection.provider,
                externalAccountId:
                  revokedConnection.externalAccountId,
              },
            },
          });

          return revokedConnection;
        },
      );

    return GitConnectionMapper.withRelations(
      connection,
    );
  }

  async reactivate(
    organizationId: string,
    connectionId: string,
    currentUserId: string,
  ) {
    const existingConnection =
      await this.ensureConnectionExists(
        organizationId,
        connectionId,
      );

    if (
      existingConnection.status ===
      ConnectionStatus.ACTIVE
    ) {
      throw new ConflictException(
        'Cette connexion Git est déjà active.',
      );
    }

    const connection =
      await this.prisma.$transaction(
        async (transaction) => {
          const reactivatedConnection =
            await transaction.gitConnection.update({
              where: {
                id: connectionId,
              },
              data: {
                status: ConnectionStatus.ACTIVE,
                revokedAt: null,
              },
              include:
                GIT_CONNECTION_RESPONSE_INCLUDE,
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              actorId: currentUserId,
              action: AuditAction.CONNECT,
              resourceType: 'GitConnection',
              resourceId: connectionId,
              description: `Connexion ${reactivatedConnection.provider} réactivée`,
              metadata: {
                previousStatus:
                  existingConnection.status,
                newStatus:
                  ConnectionStatus.ACTIVE,
              },
            },
          });

          return reactivatedConnection;
        },
      );

    return GitConnectionMapper.withRelations(
      connection,
    );
  }

  async remove(
    organizationId: string,
    connectionId: string,
    currentUserId: string,
  ) {
    const connection =
      await this.ensureConnectionExists(
        organizationId,
        connectionId,
      );

    const repositoriesCount =
      await this.prisma.repository.count({
        where: {
          gitConnectionId: connectionId,
        },
      });

    if (repositoriesCount > 0) {
      throw new ConflictException(
        'Cette connexion contient encore des dépôts. Supprimez ou déplacez les dépôts avant de supprimer la connexion.',
      );
    }

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.auditLog.create({
          data: {
            organizationId,
            actorId: currentUserId,
            action: AuditAction.DELETE,
            resourceType: 'GitConnection',
            resourceId: connectionId,
            description: `Connexion ${connection.provider} supprimée`,
            metadata: {
              provider: connection.provider,
              externalAccountId:
                connection.externalAccountId,
            },
          },
        });

        await transaction.gitConnection.delete({
          where: {
            id: connectionId,
          },
        });
      },
    );

    return {
      message:
        'Connexion Git supprimée avec succès.',
    };
  }

  private async ensureOrganizationExists(
    organizationId: string,
  ) {
    const organization =
      await this.prisma.organization.findUnique({
        where: {
          id: organizationId,
        },
        select: {
          id: true,
        },
      });

    if (!organization) {
      throw new NotFoundException(
        'Organisation introuvable.',
      );
    }

    return organization;
  }

  private async ensureConnectionExists(
    organizationId: string,
    connectionId: string,
  ) {
    const connection =
      await this.prisma.gitConnection.findFirst({
        where: {
          id: connectionId,
          organizationId,
        },
      });

    if (!connection) {
      throw new NotFoundException(
        'Connexion Git introuvable.',
      );
    }

    return connection;
  }

  private parseOptionalDate(
    value?: string | null,
  ): Date | null {
    if (!value) {
      return null;
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        'La date d’expiration du jeton est invalide.',
      );
    }

    return date;
  }

  private normalizeOptionalText(
    value?: string | null,
  ): string | null | undefined {
    if (value == null) {
      return value;
    }

    const normalized = value.trim();

    return normalized.length > 0
      ? normalized
      : null;
  }

  private handlePrismaConflict(
    error: unknown,
  ): void {
    if (
      error instanceof
        Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'Cette connexion Git existe déjà.',
      );
    }
  }
}
