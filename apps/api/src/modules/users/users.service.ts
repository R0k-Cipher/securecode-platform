import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';


import { PrismaService } from '@securecode-platform/database';

import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersQueryDto } from './dto/users-query.dto';
import { toSafeUser } from './mappers/user.mapper';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: UsersQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              {
                email: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                firstName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };

    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      data: users.map(toSafeUser),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return toSafeUser(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }

  async getCurrentUser(userId: string) {
    return this.findById(userId);
  }

  async updateCurrentUser(userId: string, dto: UpdateProfileDto) {
    await this.ensureUserExists(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.firstName !== undefined
          ? { firstName: dto.firstName.trim() }
          : {}),
        ...(dto.lastName !== undefined
          ? { lastName: dto.lastName.trim() }
          : {}),
        ...(dto.avatarUrl !== undefined
          ? { avatarUrl: dto.avatarUrl }
          : {}),
      },
    });

    return toSafeUser(user);
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    await this.ensureUserExists(id);

    if (dto.email) {
      await this.ensureEmailAvailable(dto.email, id);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName !== undefined
          ? { firstName: dto.firstName.trim() }
          : {}),
        ...(dto.lastName !== undefined
          ? { lastName: dto.lastName.trim() }
          : {}),
        ...(dto.email !== undefined
          ? { email: dto.email.trim().toLowerCase() }
          : {}),
        ...(dto.avatarUrl !== undefined
          ? { avatarUrl: dto.avatarUrl }
          : {}),
        ...(dto.status !== undefined
          ? { status: dto.status }
          : {}),
      },
    });

    return toSafeUser(user);
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    await this.ensureUserExists(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        status: dto.status,
      },
    });

    return toSafeUser(user);
  }

  async deleteUser(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer votre propre compte depuis cette route',
      );
    }

    await this.ensureUserExists(id);

    await this.prisma.user.delete({
      where: { id },
    });

    return {
      message: 'Utilisateur supprimé avec succès',
    };
  }

  async suspendUser(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas suspendre votre propre compte',
      );
    }

    return this.updateStatus(id, {
      status: UserStatus.SUSPENDED,
    });
  }

  private async ensureUserExists(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
  }

  private async ensureEmailAvailable(
    email: string,
    excludedUserId?: string,
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        ...(excludedUserId
          ? {
              id: {
                not: excludedUserId,
              },
            }
          : {}),
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'Cette adresse email est déjà utilisée',
      );
    }
  }
}
