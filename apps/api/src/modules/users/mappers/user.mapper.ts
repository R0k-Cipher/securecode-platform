import type { User } from '@prisma/client';
import type { SafeUser } from '../types/safe-user.type';

export function toSafeUser(user: User): SafeUser {
  const { passwordHash, ...safeUser } = user;

  return safeUser;
}
