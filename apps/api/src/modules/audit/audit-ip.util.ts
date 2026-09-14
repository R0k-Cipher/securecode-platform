import type {
  Request,
} from 'express';

export function getClientIp(
  request: Request,
): string | null {
  const forwarded =
    request.headers[
      'x-forwarded-for'
    ];

  if (
    typeof forwarded ===
    'string'
  ) {
    const firstIp =
      forwarded
        .split(',')[0]
        ?.trim();

    if (firstIp) {
      return firstIp;
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
    request.ip ||
    request.socket
      ?.remoteAddress ||
    null
  );
}
