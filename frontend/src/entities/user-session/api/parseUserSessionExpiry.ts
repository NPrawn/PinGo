const TIMEZONE_SUFFIX = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Parses both the current timezone-aware value and legacy UTC wall-clock values.
 * Values without an offset were produced by the old backend and are treated as UTC.
 */
export function parseUserSessionExpiry(expiresAt?: string): number | null {
  if (!expiresAt) return null;

  const value = expiresAt.trim();
  if (!value) return null;

  const normalized = TIMEZONE_SUFFIX.test(value) ? value : `${value}Z`;
  const expiresAtMs = Date.parse(normalized);
  return Number.isFinite(expiresAtMs) ? expiresAtMs : null;
}

export function isUsableUserSession(expiresAt?: string): boolean {
  const expiresAtMs = parseUserSessionExpiry(expiresAt);
  return expiresAtMs !== null && expiresAtMs > Date.now();
}
