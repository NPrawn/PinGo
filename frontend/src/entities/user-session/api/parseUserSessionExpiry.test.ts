import { isUsableUserSession, parseUserSessionExpiry } from './parseUserSessionExpiry';

describe('user session expiry parsing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-04T03:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('treats legacy timezone-less values as UTC', () => {
    expect(parseUserSessionExpiry('2026-08-04T09:11:56.066746566')).toBe(
      Date.parse('2026-08-04T09:11:56.066746566Z'),
    );
  });

  it('preserves an explicit timezone offset', () => {
    expect(parseUserSessionExpiry('2026-08-04T12:11:56+09:00')).toBe(
      Date.parse('2026-08-04T03:11:56Z'),
    );
  });

  it('checks usability against the current instant', () => {
    expect(isUsableUserSession('2026-08-04T03:01:00Z')).toBe(true);
    expect(isUsableUserSession('2026-08-04T02:59:00Z')).toBe(false);
  });
});
