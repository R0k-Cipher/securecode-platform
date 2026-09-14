import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import {
  Reflector,
} from '@nestjs/core';

import type {
  Request,
} from 'express';

import {
  RbacService,
} from '../rbac.service';

import type {
  PermissionCode,
} from '../types/permission-code.type';

/*
 * IMPORTANT :
 *
 * Garde ici l'import venant de TON fichier existant :
 *
 * require-permissions.decorator.ts
 *
 * Ne crée pas permissions.decorator.ts si ton projet
 * possède déjà le décorateur correct.
 */
import {
  REQUIRED_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';

  interface AuthenticatedRequestUser {
    id: string;

    sessionId: string;

    platformRole:
      | 'USER'
      | 'PLATFORM_ADMIN';

    organizationIdentityId:
      string | null;

    organizationId:
      string | null;

    login:
      string | null;
  }

  interface RouteParams {
    organizationId?: string;
    projectId?: string;
  }

  type AuthenticatedRequest =
    Request<RouteParams> & {
      user?: AuthenticatedRequestUser;
    };


@Injectable()
export class PermissionsGuard
  implements CanActivate
{
  constructor(
    private readonly reflector: Reflector,

    private readonly rbacService: RbacService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<
        PermissionCode[]
      >(
        REQUIRED_PERMISSIONS_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      ) ?? [];

    if (
      requiredPermissions.length ===
      0
    ) {
      return true;
    }

    const request =
      context
        .switchToHttp()
        .getRequest<AuthenticatedRequest>();

    const user =
      request.user;

    if (!user) {
      throw new UnauthorizedException(
        'Utilisateur non authentifié.',
      );
    }

    if (
      user.platformRole ===
      'PLATFORM_ADMIN'
    ) {
      throw new ForbiddenException(
        "Le Platform Admin ne peut pas accéder aux ressources métier d'une organisation cliente.",
      );
    }

    const organizationId =
      request.params.organizationId;

    if (!organizationId) {
      throw new ForbiddenException(
        "Le contexte d'organisation est obligatoire.",
      );
    }

    if (
      !user.organizationId ||
      user.organizationId !==
        organizationId
    ) {
      throw new ForbiddenException(
        "Vous ne pouvez pas accéder à une autre organisation.",
      );
    }

    if (
      !user.organizationIdentityId
    ) {
      throw new ForbiddenException(
        "Identité d'organisation absente.",
      );
    }

    const projectId =
      request.params.projectId;

    if (projectId) {
      const permissions =
        await this.rbacService.getProjectPermissions(
          organizationId,
          projectId,
          user.id,
        );

      const allowed =
        requiredPermissions.every(
          (permission) =>
            permissions.includes(
              permission,
            ),
        );

      if (!allowed) {
        throw new ForbiddenException(
          'Permissions projet insuffisantes.',
        );
      }

      return true;
    }

    const permissions =
      await this.rbacService.getOrganizationPermissions(
        organizationId,
        user.id,
      );

    const allowed =
      requiredPermissions.every(
        (permission) =>
          permissions.includes(
            permission,
          ),
      );

    if (!allowed) {
      throw new ForbiddenException(
        "Permissions d'organisation insuffisantes.",
      );
    }

    return true;
  }
}
