import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  ConnectionStatus,
  Prisma,
  RepositorySyncStatus,
  RepositoryVisibility,
  ScanStatus,
} from '@prisma/client';

import { PrismaService } from '@securecode-platform/database';

import { CreateRepositoryDto } from './dto/create-repository.dto';
import { RepositoryQueryDto } from './dto/repository-query.dto';
import { UpdateRepositoryDto } from './dto/update-repository.dto';
import {
  RepositoryMapper,
  REPOSITORY_RESPONSE_INCLUDE,
} from './mappers/repository.mapper';

@Injectable()
export class RepositoriesService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    organizationId: string,
    projectId: string,
    currentUserId: string,
    dto: CreateRepositoryDto,
  ) {
    const project = await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    const gitConnection =
      await this.prisma.gitConnection.findFirst({
        where: {
          id: dto.gitConnectionId,
          organizationId,
        },
      });

    if (!gitConnection) {
      throw new NotFoundException(
        'Connexion Git introuvable dans cette organisation.',
      );
    }

    if (
      gitConnection.status !== ConnectionStatus.ACTIVE
    ) {
      throw new ConflictException(
        'La connexion Git sélectionnée n’est pas active.',
      );
    }

    if (gitConnection.provider !== dto.provider) {
      throw new ConflictException(
        'Le fournisseur du dépôt ne correspond pas au fournisseur de la connexion Git.',
      );
    }

    const externalId = dto.externalId.trim();
    const fullName = dto.fullName.trim();


    const owner =
      fullName.split('/')[0]?.trim();

    if (!owner) {
      throw new ConflictException(
        'Le propriétaire du dépôt est invalide.',
      );
    }

    const visibility =
      dto.visibility ??
      RepositoryVisibility.PRIVATE;
    const existingRepository =
      await this.prisma.repository.findFirst({
        where: {
          OR: [
            {
              gitConnectionId:
                gitConnection.id,
              externalId,
            },
            {
              projectId,
              fullName,
            },
          ],
        },
        select: {
          id: true,
          projectId: true,
          fullName: true,
        },
      });

    if (existingRepository) {
      throw new ConflictException(
        'Ce dépôt est déjà enregistré dans la plateforme.',
      );
    }

    try {
      const repository =
        await this.prisma.$transaction(
          async (transaction) => {
            const createdRepository =
              await transaction.repository.create({
                data: {
                  organizationId,

                  projectId,

                  gitConnectionId:
                    gitConnection.id,

                  createdById:
                    currentUserId,

                  provider:
                    dto.provider,

                  externalId,

                  nodeId:
                    null,

                  owner,

                  name:
                    dto.name.trim(),

                  fullName,

                  description:
                    null,

                  defaultBranch:
                    dto.defaultBranch.trim(),

                  cloneUrl:
                    dto.cloneUrl.trim(),

                  sshUrl:
                    null,

                  webUrl:
                    dto.webUrl.trim(),

                  visibility,

                  isPrivate:
                    visibility ===
                    RepositoryVisibility.PRIVATE,

                  isFork:
                    false,

                  isArchived:
                    false,

                  primaryLanguage:
                    null,

                  lastRemoteCommitSha:
                    null,

                  syncStatus:
                    RepositorySyncStatus.NOT_SYNCED,

                  lastSyncedAt:
                    null,
                },

                include:
                  REPOSITORY_RESPONSE_INCLUDE,
              });

            if (!project.defaultBranch) {
              await transaction.project.update({
                where: {
                  id: projectId,
                },
                data: {
                  defaultBranch:
                    createdRepository.defaultBranch,
                },
              });
            }

            await transaction.auditLog.create({
              data: {
                organizationId,
                projectId,
                actorId: currentUserId,
                action: AuditAction.CONNECT,
                resourceType: 'Repository',
                resourceId:
                  createdRepository.id,
                description: `Dépôt "${createdRepository.fullName}" connecté au projet "${project.name}"`,
                metadata: {
                  provider:
                    createdRepository.provider,
                  externalId:
                    createdRepository.externalId,
                  gitConnectionId:
                    createdRepository.gitConnectionId,
                  visibility:
                    createdRepository.visibility,
                },
              },
            });

            return createdRepository;
          },
        );

      return RepositoryMapper.withRelations(
        repository,
      );
    } catch (error: unknown) {
      this.handlePrismaConflict(error);
      throw error;
    }
  }

  async findAll(
    organizationId: string,
    projectId: string,
    query: RepositoryQueryDto,
  ) {
    await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.RepositoryWhereInput = {
      projectId,

      ...(query.provider
        ? {
            provider: query.provider,
          }
        : {}),

      ...(query.visibility
        ? {
            visibility: query.visibility,
          }
        : {}),

      ...(query.isArchived !== undefined
        ? {
            isArchived: query.isArchived,
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                fullName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                externalId: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.RepositoryOrderByWithRelationInput =
      {
        [query.sortBy ?? 'updatedAt']:
          query.sortOrder ?? 'desc',
      };

    const [repositories, total] =
      await this.prisma.$transaction([
        this.prisma.repository.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include:
            REPOSITORY_RESPONSE_INCLUDE,
        }),

        this.prisma.repository.count({
          where,
        }),
      ]);

    return {
      data: repositories.map((repository) =>
        RepositoryMapper.withRelations(
          repository,
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
    projectId: string,
    repositoryId: string,
  ) {
    await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    const repository =
      await this.prisma.repository.findFirst({
        where: {
          id: repositoryId,
          projectId,
          project: {
            organizationId,
          },
        },
        include:
          REPOSITORY_RESPONSE_INCLUDE,
      });

    if (!repository) {
      throw new NotFoundException(
        'Dépôt introuvable.',
      );
    }

    return RepositoryMapper.withRelations(
      repository,
    );
  }

  async securityOverview(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    const repository =
      await this.ensureRepositoryExists(
        organizationId,
        projectId,
        repositoryId,
      );

    const [
      latestScan,
      scansCount,
      findingsCount,
    ] =
      await this.prisma.$transaction([
        this.prisma.scan.findFirst({
          where: {
            repositoryId,
            projectId,
          },

          orderBy: {
            createdAt: 'desc',
          },

          select: {
            id: true,
            type: true,
            status: true,
            progress: true,

            score: true,

            startedAt: true,
            completedAt: true,
            failedAt: true,

            errorMessage: true,

            statistics: true,

            createdAt: true,
            updatedAt: true,

            _count: {
              select: {
                findings: true,
              },
            },
          },
        }),

        this.prisma.scan.count({
          where: {
            repositoryId,
            projectId,
          },
        }),

        this.prisma.finding.count({
          where: {
            repositoryId,
            projectId,
          },
        }),
      ]);

    return {
      repository: {
        id:
          repository.id,

        provider:
          repository.provider,

        owner:
          repository.owner,

        name:
          repository.name,

        fullName:
          repository.fullName,

        defaultBranch:
          repository.defaultBranch,

        webUrl:
          repository.webUrl,

        visibility:
          repository.visibility,

        isPrivate:
          repository.isPrivate,

        isArchived:
          repository.isArchived,

        primaryLanguage:
          repository.primaryLanguage,

        syncStatus:
          repository.syncStatus,

        lastSyncedAt:
          repository.lastSyncedAt,

        lastRemoteCommitSha:
          repository.lastRemoteCommitSha,
      },

      latestScan,

      counters: {
        scans:
          scansCount,

        findings:
          findingsCount,
      },
    };
  }

  async update(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    currentUserId: string,
    dto: UpdateRepositoryDto,
  ) {
    const repository =
      await this.ensureRepositoryExists(
        organizationId,
        projectId,
        repositoryId,
      );

    if (repository.isArchived) {
      throw new ConflictException(
        'Un dépôt archivé doit être restauré avant sa modification.',
      );
    }

    if (
      dto.fullName !== undefined &&
      dto.fullName.trim() !== repository.fullName
    ) {
      const duplicate =
        await this.prisma.repository.findFirst({
          where: {
            projectId,
            fullName: dto.fullName.trim(),
            id: {
              not: repositoryId,
            },
          },
          select: {
            id: true,
          },
        });

      if (duplicate) {
        throw new ConflictException(
          'Un dépôt portant ce nom complet existe déjà dans le projet.',
        );
      }
    }

    try {
      const updatedRepository =
        await this.prisma.$transaction(
          async (transaction) => {
            const result =
              await transaction.repository.update({
                where: {
                  id: repositoryId,
                },
                data: {
                  ...(dto.name !== undefined
                    ? {
                        name: dto.name.trim(),
                      }
                    : {}),

                  ...(dto.fullName !== undefined
                    ? {
                        fullName:
                          dto.fullName.trim(),
                      }
                    : {}),

                  ...(dto.cloneUrl !== undefined
                    ? {
                        cloneUrl:
                          dto.cloneUrl.trim(),
                      }
                    : {}),

                  ...(dto.webUrl !== undefined
                    ? {
                        webUrl:
                          dto.webUrl.trim(),
                      }
                    : {}),

                  ...(dto.defaultBranch !==
                  undefined
                    ? {
                        defaultBranch:
                          dto.defaultBranch.trim(),
                      }
                    : {}),

                  ...(dto.visibility !== undefined
                    ? {
                        visibility:
                          dto.visibility,
                      }
                    : {}),
                },
                include:
                  REPOSITORY_RESPONSE_INCLUDE,
              });

            await transaction.auditLog.create({
              data: {
                organizationId,
                projectId,
                actorId: currentUserId,
                action: AuditAction.UPDATE,
                resourceType: 'Repository',
                resourceId: repositoryId,
                description: `Dépôt "${result.fullName}" modifié`,
                metadata: {
                  updatedFields:
                    Object.keys(dto),
                },
              },
            });

            return result;
          },
        );

      return RepositoryMapper.withRelations(
        updatedRepository,
      );
    } catch (error: unknown) {
      this.handlePrismaConflict(error);
      throw error;
    }
  }

  async archive(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    currentUserId: string,
  ) {
    const repository =
      await this.ensureRepositoryExists(
        organizationId,
        projectId,
        repositoryId,
      );

    if (repository.isArchived) {
      throw new ConflictException(
        'Ce dépôt est déjà archivé.',
      );
    }

    const activeScan =
      await this.prisma.scan.findFirst({
        where: {
          repositoryId,
          status: {
            notIn: [
              ScanStatus.COMPLETED,
              ScanStatus.FAILED,
              ScanStatus.CANCELLED,
            ],
          },
        },
        select: {
          id: true,
        },
      });

    if (activeScan) {
      throw new ConflictException(
        'Impossible d’archiver un dépôt contenant une analyse active.',
      );
    }

    const archivedRepository =
      await this.prisma.$transaction(
        async (transaction) => {
          const result =
            await transaction.repository.update({
              where: {
                id: repositoryId,
              },
              data: {
                isArchived: true,
              },
              include:
                REPOSITORY_RESPONSE_INCLUDE,
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              projectId,
              actorId: currentUserId,
              action: AuditAction.UPDATE,
              resourceType: 'Repository',
              resourceId: repositoryId,
              description: `Dépôt "${result.fullName}" archivé`,
              metadata: {
                previousIsArchived: false,
                newIsArchived: true,
              },
            },
          });

          return result;
        },
      );

    return RepositoryMapper.withRelations(
      archivedRepository,
    );
  }

  async restore(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    currentUserId: string,
  ) {
    const repository =
      await this.ensureRepositoryExists(
        organizationId,
        projectId,
        repositoryId,
      );

    if (!repository.isArchived) {
      throw new ConflictException(
        'Seul un dépôt archivé peut être restauré.',
      );
    }

    const restoredRepository =
      await this.prisma.$transaction(
        async (transaction) => {
          const result =
            await transaction.repository.update({
              where: {
                id: repositoryId,
              },
              data: {
                isArchived: false,
              },
              include:
                REPOSITORY_RESPONSE_INCLUDE,
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              projectId,
              actorId: currentUserId,
              action: AuditAction.UPDATE,
              resourceType: 'Repository',
              resourceId: repositoryId,
              description: `Dépôt "${result.fullName}" restauré`,
              metadata: {
                previousIsArchived: true,
                newIsArchived: false,
              },
            },
          });

          return result;
        },
      );

    return RepositoryMapper.withRelations(
      restoredRepository,
    );
  }

  async markAsSynchronized(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    currentUserId: string,
  ) {
    const repository =
      await this.ensureRepositoryExists(
        organizationId,
        projectId,
        repositoryId,
      );

    if (repository.isArchived) {
      throw new ConflictException(
        'Un dépôt archivé ne peut pas être synchronisé.',
      );
    }

    const gitConnection =
      await this.prisma.gitConnection.findUnique({
        where: {
          id: repository.gitConnectionId,
        },
        select: {
          status: true,
        },
      });

    if (
      !gitConnection ||
      gitConnection.status !==
        ConnectionStatus.ACTIVE
    ) {
      throw new ConflictException(
        'La connexion Git du dépôt n’est pas active.',
      );
    }

    const synchronizationDate = new Date();

    const synchronizedRepository =
      await this.prisma.$transaction(
        async (transaction) => {
          const result =
            await transaction.repository.update({
              where: {
                id: repositoryId,
              },
              data: {
                lastSyncedAt:
                  synchronizationDate,
              },
              include:
                REPOSITORY_RESPONSE_INCLUDE,
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              projectId,
              actorId: currentUserId,
              action: AuditAction.UPDATE,
              resourceType: 'Repository',
              resourceId: repositoryId,
              description: `Synchronisation du dépôt "${result.fullName}" enregistrée`,
              metadata: {
                synchronizedAt:
                  synchronizationDate.toISOString(),
              },
            },
          });

          return result;
        },
      );

    return RepositoryMapper.withRelations(
      synchronizedRepository,
    );
  }

  async remove(
    organizationId: string,
    projectId: string,
    repositoryId: string,
    currentUserId: string,
  ) {
    const repository =
      await this.ensureRepositoryExists(
        organizationId,
        projectId,
        repositoryId,
      );

    const activeScan =
      await this.prisma.scan.findFirst({
        where: {
          repositoryId,
          status: {
            notIn: [
              ScanStatus.COMPLETED,
              ScanStatus.FAILED,
              ScanStatus.CANCELLED,
            ],
          },
        },
        select: {
          id: true,
        },
      });

    if (activeScan) {
      throw new ConflictException(
        'Impossible de supprimer un dépôt contenant une analyse active.',
      );
    }

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.auditLog.create({
          data: {
            organizationId,
            projectId,
            actorId: currentUserId,
            action: AuditAction.DISCONNECT,
            resourceType: 'Repository',
            resourceId: repositoryId,
            description: `Dépôt "${repository.fullName}" supprimé du projet`,
            metadata: {
              provider: repository.provider,
              externalId:
                repository.externalId,
              gitConnectionId:
                repository.gitConnectionId,
            },
          },
        });

        await transaction.repository.delete({
          where: {
            id: repositoryId,
          },
        });
      },
    );

    return {
      message:
        'Dépôt supprimé avec succès.',
    };
  }

  private async ensureProjectExists(
    organizationId: string,
    projectId: string,
  ) {
    const project =
      await this.prisma.project.findFirst({
        where: {
          id: projectId,
          organizationId,
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable dans cette organisation.',
      );
    }

    return project;
  }

  private async ensureRepositoryExists(
    organizationId: string,
    projectId: string,
    repositoryId: string,
  ) {
    const repository =
      await this.prisma.repository.findFirst({
        where: {
          id: repositoryId,
          projectId,
          project: {
            organizationId,
          },
        },
      });

    if (!repository) {
      throw new NotFoundException(
        'Dépôt introuvable.',
      );
    }

    return repository;
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
        'Un dépôt possédant ces informations existe déjà.',
      );
    }
  }
}
