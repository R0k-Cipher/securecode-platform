import { SetMetadata } from '@nestjs/common';

import type { PermissionCode } from '../types/permission-code.type';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';

/**
 * Définit les permissions nécessaires pour accéder à une route.
 *
 * Exemple :
 *
 * @RequirePermissions(
 *   PERMISSION_CODES.MEMBER_READ,
 *   PERMISSION_CODES.MEMBER_INVITE,
 * )
 */
export const RequirePermissions = (
  ...permissions: PermissionCode[]
) =>
  SetMetadata(
    REQUIRED_PERMISSIONS_KEY,
    permissions,
  );
