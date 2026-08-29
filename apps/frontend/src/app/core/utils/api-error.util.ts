export function getApiErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (
    typeof error === 'object' &&
    error !== null
  ) {
    const candidate =
      error as {
        error?: {
          message?: unknown;
        };
      };

    const message =
      candidate.error?.message;

    if (
      Array.isArray(message)
    ) {
      return message
        .map(
          (item) =>
            String(item),
        )
        .join(' ');
    }

    if (
      typeof message ===
        'string' &&
      message.trim()
    ) {
      return message.trim();
    }
  }

  return fallback;
}
