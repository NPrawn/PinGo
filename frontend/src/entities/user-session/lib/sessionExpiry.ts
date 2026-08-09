/**
 * User-session timestamps are stored by the backend in UTC, but its current
 * response DTO omits the offset. Browsers otherwise interpret that value as
 * local time and expire a six-hour session three hours early in Korea.
 */
export function sessionExpiryMs(expiresAt?: string): number {
  if (!expiresAt) return Number.NaN;
  const hasOffset = /(?:z|[+-]\d{2}:\d{2})$/i.test(expiresAt);
  return Date.parse(hasOffset ? expiresAt : `${expiresAt}Z`);
}
