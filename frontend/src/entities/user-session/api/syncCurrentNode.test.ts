import { syncPendingCurrentNode, queueCurrentNodeSync } from './syncCurrentNode';
import { useUserSessionStore } from '../model/userSessionStore';

const apiMocks = vi.hoisted(() => ({
  updateUserSession: vi.fn(),
}));

vi.mock('@/shared/api', () => apiMocks);

describe('current node session synchronization', () => {
  it('persists the pending node and clears it after a retry succeeds', async () => {
    vi.useFakeTimers();
    useUserSessionStore.getState().setSession({ userSessionId: 'session-1' });
    apiMocks.updateUserSession
      .mockRejectedValueOnce(new Error('temporary network error'))
      .mockResolvedValueOnce({});

    try {
      queueCurrentNodeSync(203);

      expect(useUserSessionStore.getState().pendingCurrentNodeId).toBe(203);
      expect(sessionStorage.getItem('pingo.user-session')).toContain('"pendingCurrentNodeId":203');

      const sync = syncPendingCurrentNode();
      await vi.advanceTimersByTimeAsync(500);

      await expect(sync).resolves.toBe(true);
      expect(apiMocks.updateUserSession).toHaveBeenCalledTimes(2);
      expect(useUserSessionStore.getState().pendingCurrentNodeId).toBeUndefined();
      expect(sessionStorage.getItem('pingo.user-session')).not.toContain('pendingCurrentNodeId');
    } finally {
      useUserSessionStore.getState().clearSession();
      apiMocks.updateUserSession.mockReset();
      vi.useRealTimers();
    }
  });
});
