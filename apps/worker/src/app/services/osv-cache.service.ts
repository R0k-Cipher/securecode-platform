import {
  Injectable,
} from '@nestjs/common';

interface OsvCacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class OsvCacheService {
  private readonly cache =
    new Map<
      string,
      OsvCacheEntry<unknown>
    >();

  private readonly defaultTtlMs =
    6 * 60 * 60 * 1000;

  get<T>(
    key: string,
  ): T | undefined {
    const entry =
      this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (
      entry.expiresAt <=
      Date.now()
    ) {
      this.cache.delete(
        key,
      );

      return undefined;
    }

    return entry.value as T;
  }

  set<T>(
    key: string,
    value: T,
    ttlMs =
      this.defaultTtlMs,
  ): void {
    this.cache.set(
      key,
      {
        value,
        expiresAt:
          Date.now() +
          ttlMs,
      },
    );
  }

  has(
    key: string,
  ): boolean {
    return (
      this.get(key) !==
      undefined
    );
  }

  pruneExpired(): number {
    const now =
      Date.now();

    let removed =
      0;

    for (
      const [
        key,
        entry,
      ] of this.cache
    ) {
      if (
        entry.expiresAt <=
        now
      ) {
        this.cache.delete(
          key,
        );

        removed += 1;
      }
    }

    return removed;
  }

  get size(): number {
    return this.cache.size;
  }
}
