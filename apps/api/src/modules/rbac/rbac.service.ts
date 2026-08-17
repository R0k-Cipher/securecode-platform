import {
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '@securecode-platform/database';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getUserPermissions(
    organizationId: string,
    userId: string,
  ): Promise<string[]> {
    const member =
      await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
        include: {
          role: {
            include: {
              permissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      });

    if (!member) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de cette organisation.",
      );
    }

    return member.role.permissions.map(
      (permission) => permission.permission.code,
    );
  }

  async hasPermission(
    organizationId: string,
    userId: string,
    permission: string,
  ): Promise<boolean> {
    const permissions =
      await this.getUserPermissions(
        organizationId,
        userId,
      );

    return permissions.includes(permission);
  }

  async requirePermission(
    organizationId: string,
    userId: string,
    permission: string,
  ) {
    const allowed =
      await this.hasPermission(
        organizationId,
        userId,
        permission,
      );

    if (!allowed) {
      throw new ForbiddenException(
        'Permission insuffisante.',
      );
    }
  }
}
