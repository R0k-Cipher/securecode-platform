import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  NotificationType,
  Prisma,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async list(
    userId: string,
    unreadOnly = false,
    limit = 50,
  ) {
    const take =
      Math.min(
        Math.max(
          limit,
          1,
        ),
        100,
      );

    const notifications =
      await this.prisma.notification
        .findMany({
          where: {
            userId,

            ...(unreadOnly
              ? {
                  readAt:
                    null,
                }
              : {}),
          },

          orderBy: {
            createdAt:
              'desc',
          },

          take,
        });

    const unread =
      await this.prisma.notification
        .count({
          where: {
            userId,
            readAt:
              null,
          },
        });

    return {
      data:
        notifications,

      unread,
    };
  }

  unreadCount(
    userId: string,
  ) {
    return this.prisma.notification
      .count({
        where: {
          userId,

          readAt:
            null,
        },
      })
      .then(
        (count) => ({
          count,
        }),
      );
  }

  async markRead(
    userId: string,
    notificationId: string,
  ) {
    const notification =
      await this.prisma.notification
        .findFirst({
          where: {
            id:
              notificationId,

            userId,
          },

          select: {
            id:
              true,

            readAt:
              true,
          },
        });

    if (!notification) {
      throw new NotFoundException(
        'Notification introuvable.',
      );
    }

    if (
      notification.readAt
    ) {
      return {
        success:
          true,
      };
    }

    await this.prisma.notification
      .update({
        where: {
          id:
            notificationId,
        },

        data: {
          readAt:
            new Date(),
        },
      });

    return {
      success:
        true,
    };
  }

  async markAllRead(
    userId: string,
  ) {
    const result =
      await this.prisma.notification
        .updateMany({
          where: {
            userId,
            readAt:
              null,
          },

          data: {
            readAt:
              new Date(),
          },
        });

    return {
      updated:
        result.count,
    };
  }

  create(
    input: {
      userId: string;
      type: NotificationType;
      title: string;
      message: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return this.prisma.notification
      .create({
        data: {
          userId:
            input.userId,

          type:
            input.type,

          title:
            input.title,

          message:
            input.message,

          metadata:
            input.metadata,
        },
      });
  }
}
