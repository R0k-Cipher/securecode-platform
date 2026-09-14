import { Injectable } from '@nestjs/common';
import {
  GitProvider,
  WebhookEventStatus,
} from '@prisma/client';

import { PrismaService } from '@securecode-platform/database';

@Injectable()
export class GithubWebhookDeduplicationService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async alreadyProcessed(
    deliveryId: string,
  ): Promise<boolean> {
    const existing = await this.prisma.webhookEvent.findUnique({
      where: {
        provider_deliveryId: {
          provider: GitProvider.GITHUB,
          deliveryId,
        },
      },
      select: {
        status: true,
      },
    });

    if (!existing) {
      return false;
    }

    return (
      existing.status === WebhookEventStatus.PROCESSED ||
      existing.status === WebhookEventStatus.IGNORED ||
      existing.status === WebhookEventStatus.PROCESSING
    );
  }
}
