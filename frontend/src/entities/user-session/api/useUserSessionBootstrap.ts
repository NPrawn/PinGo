import { useEffect } from 'react';
import { createUserSession, getUserSession } from '@/shared/api';
import { useUserSessionStore } from '../model/userSessionStore';

let creationPromise: ReturnType<typeof createUserSession> | undefined;

function isUsable(expiresAt?: string) {
  return !expiresAt || new Date(expiresAt).getTime() > Date.now();
}

export function useUserSessionBootstrap(language: string) {
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const expiresAt = useUserSessionStore((state) => state.expiresAt);
  const setSession = useUserSessionStore((state) => state.setSession);
  const clearSession = useUserSessionStore((state) => state.clearSession);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      if (userSessionId && isUsable(expiresAt)) {
        try {
          await getUserSession(userSessionId);
          return;
        } catch {
          if (!disposed) clearSession();
        }
      } else if (userSessionId) {
        clearSession();
      }

      creationPromise ??= createUserSession({
        language: ['ko', 'en', 'ja', 'zh'].includes(language)
          ? (language as 'ko' | 'en' | 'ja' | 'zh')
          : 'ko',
      });
      try {
        const session = await creationPromise;
        if (!disposed && session.userSessionId) {
          setSession({
            userSessionId: session.userSessionId,
            expiresAt: session.expiresAt,
          });
        }
      } catch {
        // The surrounding user flow remains usable and can retry on the next mount.
      } finally {
        creationPromise = undefined;
      }
    })();
    return () => {
      disposed = true;
    };
  }, [clearSession, expiresAt, language, setSession, userSessionId]);
}
