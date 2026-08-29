export function maskSecret(
  value: string,
): string {
  if (
    value.length <= 8
  ) {
    return '********';
  }

  return (
    value.slice(
      0,
      4,
    ) +
    '********' +
    value.slice(-4)
  );
}

export function sanitizeSnippet(
  snippet: string,
  matchedSecret: string,
): string {
  return snippet.replace(
    matchedSecret,
    maskSecret(
      matchedSecret,
    ),
  );
}
