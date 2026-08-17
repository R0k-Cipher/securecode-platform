import { Injectable } from '@nestjs/common';

import {
  HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';

import { PrismaService } from '@securecode-platform/database';

@Injectable()
export class PrismaHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async isHealthy(
    key: string,
  ): Promise<HealthIndicatorResult> {
    const indicator =
      this.healthIndicatorService.check(key);

    try {
      await this.prisma['$queryRaw']`SELECT 1`;

      return indicator.up();
    } catch (error: unknown) {
      return indicator.down({
        message: 'PostgreSQL inaccessible',
        error:
          error instanceof Error
            ? error.message
            : 'Erreur PostgreSQL inconnue',
      });
    }
  }
}
