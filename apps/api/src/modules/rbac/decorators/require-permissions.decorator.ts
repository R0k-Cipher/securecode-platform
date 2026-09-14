import { SetMetadata } from '@nestjs/common';

import type { PermissionCode } from '../types/permission-code.type';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';

export const RequirePermissions = (
  ...permissions: PermissionCode[]
) =>
  SetMetadata(
    REQUIRED_PERMISSIONS_KEY,
    permissions,
  );
