import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import type {
  Request,
} from 'express';

import {
  Observable,
  tap,
} from 'rxjs';

import {
  PrismaService,
} from '@securecode-platform/database';

interface AuthenticatedRequest
  extends Request {
  user?: {
    id?: string;
    sub?: string;
  };
}

@Injectable()
export class AuditIpInterceptor
implements NestInterceptor {
  constructor(
    private readonly prisma:
      PrismaService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    if (
      context.getType() !==
      'http'
    ) {
      return next.handle();
    }

    const request =
      context
        .switchToHttp()
        .getRequest<
          AuthenticatedRequest
        >();

    const startedAt =
      new Date();

    const actorId =
      request.user?.id ??
      request.user?.sub ??
      null;

    const ipAddress =
      this.resolveIp(
        request,
      );

    const userAgent =
      request.headers[
        'user-agent'
      ] ??
      null;

    return next
      .handle()
      .pipe(
        tap({
          next: () => {
            if (
              !actorId
            ) {
              return;
            }

            void this.prisma.auditLog
              .updateMany({
                where: {
                  actorId,

                  createdAt: {
                    gte:
                      startedAt,
                  },

                  ipAddress:
                    null,
                },

                data: {
                  ipAddress,

                  userAgent:
                    userAgent ??
                    undefined,
                },
              });
          },
        }),
      );
  }

  private resolveIp(
    request:
      AuthenticatedRequest,
  ): string | null {
    const cloudflareIp =
      request.headers[
        'cf-connecting-ip'
      ];

    if (
      typeof cloudflareIp ===
        'string' &&
      cloudflareIp.trim()
    ) {
      return cloudflareIp
        .trim();
    }

    const forwarded =
      request.headers[
        'x-forwarded-for'
      ];

    if (
      typeof forwarded ===
      'string'
    ) {
      const ip =
        forwarded
          .split(',')[0]
          ?.trim();

      if (ip) {
        return ip;
      }
    }

    if (
      Array.isArray(
        forwarded,
      ) &&
      forwarded.length
    ) {
      return forwarded[0] ??
        null;
    }

    return (
      request.ip ??
      request.socket
        ?.remoteAddress ??
      null
    );
  }
}
