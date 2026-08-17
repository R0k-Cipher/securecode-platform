import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  Prisma,
  ProjectStatus,
  ScanStatus,
} from '@prisma/client';

import { PrismaService } from '@securecode-platform/database';

import { CreateProjectDto } from './dto/create-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectMapper } from './mappers/project.mapper';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async create(
    organizationId: string,
    currentUserId: string,
    dto: CreateProjectDto,
  ) {
    const membership =
      await this.ensureOrganizationMembership(
        organizationId,
        currentUserId,
      );

    const name = dto.name.trim();

    const slug = await this.generateUniqueSlug(
      organizationId,
      dto.slug ?? name,
    );

    const project = await this.prisma.$transaction(
      async (transaction) => {
        const createdProject =
          await transaction.project.create({
            data: {
              organizationId,
              name,
              slug,
              description: this.normalizeOptionalText(
                dto.description,
              ),
              defaultBranch:
                this.normalizeOptionalText(
                  dto.defaultBranch,
                ),
              createdById: currentUserId,
            },
          });

        await transaction.projectMember.create({
          data: {
            projectId: createdProject.id,
            userId: currentUserId,
            roleId: membership.roleId,
          },
        });

        await transaction.auditLog.create({
          data: {
            organizationId,
            projectId: createdProject.id,
            actorId: currentUserId,
            action: AuditAction.CREATE,
            resourceType: 'Project',
            resourceId: createdProject.id,
            description: `Projet "${createdProject.name}" créé`,
            metadata: {
              slug: createdProject.slug,
              status: createdProject.status,
            },
          },
        });

        return transaction.project.findUniqueOrThrow({
          where: {
            id: createdProject.id,
          },
          include: {
            _count: {
              select: {
                members: true,
                repositories: true,
                scans: true,
                findings: true,
                vulnerabilities: true,
                reports: true,
              },
            },
          },
        });
      },
    );

    return ProjectMapper.withCounts(project);
  }

  async findAll(
    organizationId: string,
    currentUserId: string,
    query: ProjectQueryDto,
  ) {
    await this.ensureOrganizationMembership(
      organizationId,
      currentUserId,
    );

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.ProjectWhereInput = {
      organizationId,
      ...(query.status
        ? {
            status: query.status,
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
                slug: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const [projects, total] =
      await this.prisma.$transaction([
        this.prisma.project.findMany({
          where,
          skip,
          take: limit,
          orderBy: {
            updatedAt: 'desc',
          },
          include: {
            _count: {
              select: {
                members: true,
                repositories: true,
                scans: true,
                findings: true,
                vulnerabilities: true,
                reports: true,
              },
            },
          },
        }),
        this.prisma.project.count({
          where,
        }),
      ]);

    return {
      data: projects.map((project) =>
        ProjectMapper.withCounts(project),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages:
          total === 0 ? 0 : Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(
    organizationId: string,
    projectId: string,
    currentUserId: string,
  ) {
    await this.ensureOrganizationMembership(
      organizationId,
      currentUserId,
    );

    const project =
      await this.prisma.project.findFirst({
        where: {
          id: projectId,
          organizationId,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          scans: {
            take: 1,
            orderBy: {
              createdAt: 'desc',
            },
            select: {
              id: true,
              status: true,
              score: true,
              branch: true,
              commitSha: true,
              createdAt: true,
              completedAt: true,
            },
          },
          _count: {
            select: {
              members: true,
              repositories: true,
              scans: true,
              findings: true,
              vulnerabilities: true,
              reports: true,
            },
          },
        },
      });

    if (!project) {
      throw new NotFoundException(
        'Projet introuvable.',
      );
    }

    return ProjectMapper.withDetails(project);
  }

  async update(
    organizationId: string,
    projectId: string,
    currentUserId: string,
    dto: UpdateProjectDto,
  ) {
    const existingProject =
      await this.ensureProjectExists(
        organizationId,
        projectId,
      );

    if (existingProject.status === ProjectStatus.ARCHIVED) {
      throw new ConflictException(
        'Un projet archivé doit être restauré avant sa modification.',
      );
    }

    let slug: string | undefined;

    if (dto.slug !== undefined) {
      slug = await this.generateUniqueSlug(
        organizationId,
        dto.slug,
        projectId,
      );
    }

    const updatedProject =
      await this.prisma.$transaction(
        async (transaction) => {
          const project =
            await transaction.project.update({
              where: {
                id: projectId,
              },
              data: {
                ...(dto.name !== undefined
                  ? {
                      name: dto.name.trim(),
                    }
                  : {}),
                ...(slug !== undefined
                  ? {
                      slug,
                    }
                  : {}),
                ...(dto.description !== undefined
                  ? {
                      description:
                        this.normalizeOptionalText(
                          dto.description,
                        ),
                    }
                  : {}),
                ...(dto.defaultBranch !== undefined
                  ? {
                      defaultBranch:
                        this.normalizeOptionalText(
                          dto.defaultBranch,
                        ),
                    }
                  : {}),
              },
              include: {
                _count: {
                  select: {
                    members: true,
                    repositories: true,
                    scans: true,
                    findings: true,
                    vulnerabilities: true,
                    reports: true,
                  },
                },
              },
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              projectId,
              actorId: currentUserId,
              action: AuditAction.UPDATE,
              resourceType: 'Project',
              resourceId: projectId,
              description: `Projet "${project.name}" modifié`,
              metadata: {
                updatedFields: Object.keys(dto),
              },
            },
          });

          return project;
        },
      );

    return ProjectMapper.withCounts(updatedProject);
  }

  async archive(
    organizationId: string,
    projectId: string,
    currentUserId: string,
  ) {
    const project = await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    if (project.status === ProjectStatus.ARCHIVED) {
      throw new ConflictException(
        'Ce projet est déjà archivé.',
      );
    }

    const runningScan =
      await this.prisma.scan.findFirst({
        where: {
          projectId,
          status: {
            in: [
              ScanStatus.QUEUED,
              ScanStatus.PREPARING,
              ScanStatus.DOWNLOADING,
              ScanStatus.DETECTING,
              ScanStatus.SCANNING,
              ScanStatus.PROCESSING_RESULTS,
              ScanStatus.CALCULATING_SCORE,
              ScanStatus.GENERATING_REPORT,
            ],
          },
        },
        select: {
          id: true,
        },
      });

    if (runningScan) {
      throw new ConflictException(
        "Impossible d'archiver un projet contenant une analyse active.",
      );
    }

    const archivedProject =
      await this.prisma.$transaction(
        async (transaction) => {
          const result =
            await transaction.project.update({
              where: {
                id: projectId,
              },
              data: {
                status: ProjectStatus.ARCHIVED,
                archivedAt: new Date(),
              },
              include: {
                _count: {
                  select: {
                    members: true,
                    repositories: true,
                    scans: true,
                    findings: true,
                    vulnerabilities: true,
                    reports: true,
                  },
                },
              },
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              projectId,
              actorId: currentUserId,
              action: AuditAction.UPDATE,
              resourceType: 'Project',
              resourceId: projectId,
              description: `Projet "${result.name}" archivé`,
              metadata: {
                previousStatus: project.status,
                newStatus: ProjectStatus.ARCHIVED,
              },
            },
          });

          return result;
        },
      );

    return ProjectMapper.withCounts(archivedProject);
  }

  async restore(
    organizationId: string,
    projectId: string,
    currentUserId: string,
  ) {
    const project = await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    if (project.status !== ProjectStatus.ARCHIVED) {
      throw new ConflictException(
        "Seul un projet archivé peut être restauré.",
      );
    }

    const restoredProject =
      await this.prisma.$transaction(
        async (transaction) => {
          const result =
            await transaction.project.update({
              where: {
                id: projectId,
              },
              data: {
                status: ProjectStatus.ACTIVE,
                archivedAt: null,
              },
              include: {
                _count: {
                  select: {
                    members: true,
                    repositories: true,
                    scans: true,
                    findings: true,
                    vulnerabilities: true,
                    reports: true,
                  },
                },
              },
            });

          await transaction.auditLog.create({
            data: {
              organizationId,
              projectId,
              actorId: currentUserId,
              action: AuditAction.UPDATE,
              resourceType: 'Project',
              resourceId: projectId,
              description: `Projet "${result.name}" restauré`,
              metadata: {
                previousStatus: ProjectStatus.ARCHIVED,
                newStatus: ProjectStatus.ACTIVE,
              },
            },
          });

          return result;
        },
      );

    return ProjectMapper.withCounts(restoredProject);
  }

  async remove(
    organizationId: string,
    projectId: string,
    currentUserId: string,
  ) {
    const project = await this.ensureProjectExists(
      organizationId,
      projectId,
    );

    const activeScan =
      await this.prisma.scan.findFirst({
        where: {
          projectId,
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
        "Impossible de supprimer un projet contenant une analyse active.",
      );
    }

    await this.prisma.$transaction(
      async (transaction) => {
        await transaction.auditLog.create({
          data: {
            organizationId,
            projectId,
            actorId: currentUserId,
            action: AuditAction.DELETE,
            resourceType: 'Project',
            resourceId: projectId,
            description: `Projet "${project.name}" supprimé`,
            metadata: {
              slug: project.slug,
              status: project.status,
            },
          },
        });

        await transaction.project.delete({
          where: {
            id: projectId,
          },
        });
      },
    );

    return {
      message: 'Projet supprimé avec succès.',
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
          roleId: true,
          role: {
            select: {
              code: true,
            },
          },
        },
      });

    if (!membership) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de cette organisation.",
      );
    }

    return membership;
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
        'Projet introuvable.',
      );
    }

    return project;
  }

  private async generateUniqueSlug(
    organizationId: string,
    source: string,
    excludedProjectId?: string,
  ): Promise<string> {
    const baseSlug = this.slugify(source);

    if (!baseSlug) {
      throw new BadRequestException(
        'Impossible de générer un slug valide.',
      );
    }

    let candidate = baseSlug;
    let suffix = 1;

    while (
      await this.prisma.project.findFirst({
        where: {
          organizationId,
          slug: candidate,
          ...(excludedProjectId
            ? {
                id: {
                  not: excludedProjectId,
                },
              }
            : {}),
        },
        select: {
          id: true,
        },
      })
    ) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }

    return candidate;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200);
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
}
