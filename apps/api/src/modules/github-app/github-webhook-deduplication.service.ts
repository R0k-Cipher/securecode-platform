import {
  Injectable,
} from '@nestjs/common';

import {
  GitProvider,
} from '@prisma/client';

import {
  PrismaService,
} from '@securecode-platform/database';

@Injectable()
export class GithubWebhookDeduplicationService {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  async alreadyProcessed(
    deliveryId:
      string,
  ): Promise<boolean> {
    const existing =
      await this.prisma
        .webhookEvent
        .findFirst({
          where: {
            provider:
              GitProvider.GITHUB,

            eventId:
              deliveryId,
          },

          select: {
            id:
              true,
          },
        });

    return Boolean(
      existing,
    );
  }
}
