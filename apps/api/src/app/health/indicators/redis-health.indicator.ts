import {
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';

import {
  ConfigService,
} from '@nestjs/config';

import {
  HealthIndicatorService,
} from '@nestjs/terminus';

import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator
  implements OnModuleDestroy
{
  private readonly redis: Redis;

  constructor(
    private readonly configService: ConfigService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {
    this.redis = new Redis({
      host:
        this.configService.getOrThrow<string>('redis.host'),

      port:
        this.configService.getOrThrow<number>('redis.port'),

      password:
        this.configService.get<string>('redis.password') ||
        undefined,

      db:
        this.configService.get<number>('redis.database') ?? 0,

      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async isHealthy(key: string) {
    const indicator =
      this.healthIndicatorService.check(key);

    try {
      if (this.redis.status === 'wait') {
        await this.redis.connect();
      }

      const response = await this.redis.ping();

      if (response !== 'PONG') {
        return indicator.down({
          message: 'Réponse Redis invalide',
        });
      }

      return indicator.up();
    } catch {
      return indicator.down({
        message: 'Redis inaccessible',
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (
      this.redis.status !== 'end' &&
      this.redis.status !== 'wait'
    ) {
      await this.redis.quit();
    }
  }
}
