import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import {
  PlatformRole,
} from '@prisma/client';

import type {
  AuthenticatedUser,
} from '../interfaces/jwt-payload.interface';

@Injectable()
export class PlatformAdminGuard
  implements CanActivate
{
  canActivate(
    context: ExecutionContext,
  ): boolean {
    const request =
      context
        .switchToHttp()
        .getRequest<{
          user?: AuthenticatedUser;
        }>();

    const user =
      request.user;

    if (
      !user ||
      user.platformRole !==
        PlatformRole.PLATFORM_ADMIN
    ) {
      throw new ForbiddenException(
        'Accès réservé aux administrateurs de la plateforme.',
      );
    }

    return true;
  }
}
