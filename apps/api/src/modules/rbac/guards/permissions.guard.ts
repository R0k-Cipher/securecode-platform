import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';

import type { AuthenticatedUser } from '../../auth/interfaces/jwt-payload.interface';
import {
  REQUIRED_PERMISSIONS_KEY,
} from '../decorators/require-permissions.decorator';
import { RbacService } from '../rbac.service';
import type { PermissionCode } from '../types/permission-code.type';

interface RequestWithUser {
  user?: AuthenticatedUser;
  params?: {
    organizationId?: string;
  };
}

@Injectable()
export class PermissionsGuard implements CanActivate {
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
      >(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

    /*
     * Si aucune permission n'est définie sur la route,
     * le guard laisse passer la requête.
     */
    if (
      !requiredPermissions ||
      requiredPermissions.length === 0
    ) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<RequestWithUser>();

    const user = request.user;

    if (!user) {
      throw new ForbiddenException(
        'Utilisateur authentifié introuvable.',
      );
    }

    const organizationId =
      request.params?.organizationId;

    if (!organizationId) {
      throw new ForbiddenException(
        "L'identifiant de l'organisation est obligatoire pour vérifier les permissions.",
      );
    }

    const userPermissions =
      await this.rbacService.getUserPermissions(
        organizationId,
        user.id,
      );

    const hasAllPermissions =
      requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        'Vous ne disposez pas des permissions nécessaires.',
      );
    }

    return true;
  }
}
