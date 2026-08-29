import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import {
  AuditAction,
  Prisma,
} from '@prisma/client';

import {
  Observable,
  tap,
} from 'rxjs';

import {
  AuditService,
} from './audit.service';

import {
  getClientIp,
} from './audit-ip.util';

@Injectable()
export class AuditInterceptor
  implements NestInterceptor
{
  constructor(
    private readonly audit:
      AuditService,
  ) {}

  intercept(
    context:
      ExecutionContext,

    next:
      CallHandler,
  ): Observable<unknown> {
    const request =
      context
        .switchToHttp()
        .getRequest<any>();

    const method =
      String(
        request.method ??
        '',
      )
        .toUpperCase();

    const auditedMethods = [
      'POST',
      'PATCH',
      'PUT',
      'DELETE',
    ];

    if (
      !auditedMethods.includes(
        method,
      )
    ) {
      return next.handle();
    }

    return next
      .handle()
      .pipe(
        tap({
          next: (
            responseBody,
          ) => {
            const action =
              this.resolveAction(
                method,
              );

            const organizationId =
              request.params
                ?.organizationId ??
              request.body
                ?.organizationId ??
              null;

            const projectId =
              request.params
                ?.projectId ??
              request.body
                ?.projectId ??
              null;

            const actorId =
              request.user
                ?.id ??
              request.user
                ?.sub ??
              null;

            const resourceId =
              this.resolveResourceId(
                request,
                responseBody,
              );

            const resourceType =
              this.resolveResourceType(
                request,
              );

            const ipAddress =
              getClientIp(
                request,
              );

            const userAgent =
              typeof request
                .headers
                ?.['user-agent'] ===
              'string'
                ? request
                    .headers[
                      'user-agent'
                    ]
                : null;

            const metadata:
              Prisma.InputJsonValue =
              {
                method,

                path:
                  request
                    .originalUrl ??
                  request.url ??
                  '',

                statusCode:
                  request.res
                    ?.statusCode ??
                  200,
              };

            void this.audit
              .create({
                organizationId,
                projectId,
                actorId,

                action,

                resourceType,
                resourceId,

                description:
                  `${method} ${
                    request.originalUrl ??
                    request.url ??
                    ''
                  }`,

                ipAddress,
                userAgent,

                metadata,
              })
              .catch(
                () => {
                  /*
                   * Un échec d'audit ne doit jamais
                   * faire échouer la requête métier.
                   */
                },
              );
          },
        }),
      );
  }

  private resolveAction(
    method: string,
  ): AuditAction {
    switch (
      method
    ) {
      case 'POST':
        return AuditAction.CREATE;

      case 'DELETE':
        return AuditAction.DELETE;

      case 'PUT':
      case 'PATCH':
      default:
        return AuditAction.UPDATE;
    }
  }

  private resolveResourceId(
    request: any,
    responseBody:
      unknown,
  ): string | null {
    const params =
      request.params ??
      {};

    const candidates = [
      params.id,
      params.organizationId,
      params.projectId,
      params.repositoryId,
      params.repositorySyncId,
      params.scanId,
      params.findingId,
      params.memberId,
      params.invitationId,
      params.reportId,
      params.notificationId,
      params.gitConnectionId,
    ];

    for (
      const candidate
      of candidates
    ) {
      if (
        typeof candidate ===
          'string' &&
        candidate.length >
          0
      ) {
        return candidate;
      }
    }

    if (
      responseBody &&
      typeof responseBody ===
        'object' &&
      'id' in
        responseBody
    ) {
      const id =
        (
          responseBody as {
            id?: unknown;
          }
        ).id;

      if (
        typeof id ===
        'string'
      ) {
        return id;
      }
    }

    return null;
  }

  private resolveResourceType(
    request: any,
  ): string {
    const routePath =
      request.route
        ?.path;

    if (
      typeof routePath ===
        'string' &&
      routePath.length >
        0
    ) {
      return routePath;
    }

    const originalUrl =
      String(
        request.originalUrl ??
        request.url ??
        'Unknown',
      );

    return originalUrl
      .split('?')[0]
      .slice(
        0,
        255,
      );
  }
}
