import { ensureUserSession } from './ensureUserSession';
import { useUserSessionStore } from '../model/userSessionStore';

const apiMocks = vi.hoisted(() => ({
  createUserSession: vi.fn(),
}));

vi.mock('@/shared/api', () => apiMocks);

describe('ensureUserSession', () => {
  beforeEach(() => {
    useUserSessionStore.getState().clearSession();
    apiMocks.createUserSession.mockReset();
  });

  it('reuses a locally valid session without another API request', async () => {
    useUserSessionStore.getState().setSession({
      userSessionId: 'session-1',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    await expect(ensureUserSession('ko')).resolves.toBe('session-1');
    expect(apiMocks.createUserSession).not.toHaveBeenCalled();
  });

  it('creates a new session when the stored expiry has passed', async () => {
    useUserSessionStore.getState().setSession({
      userSessionId: 'expired-session',
      expiresAt: '2020-01-01T00:00:00Z',
    });
    apiMocks.createUserSession.mockResolvedValue({
      userSessionId: 'session-2',
      expiresAt: '2099-01-01T00:00:00Z',
    });

    await expect(ensureUserSession('ko')).resolves.toBe('session-2');
    expect(apiMocks.createUserSession).toHaveBeenCalledTimes(1);
  });
});
