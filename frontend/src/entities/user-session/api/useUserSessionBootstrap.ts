import { useEffect } from 'react';
import { createUserSession } from '@/shared/api';
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
    if (userSessionId && isUsable(expiresAt)) return;
    if (userSessionId) clearSession();

    creationPromise ??= createUserSession({
      language: ['ko', 'en', 'ja', 'zh'].includes(language)
        ? (language as 'ko' | 'en' | 'ja' | 'zh')
        : 'ko',
    });

    void creationPromise
      .then((session) => {
        if (!session.userSessionId) return;
        setSession({
          userSessionId: session.userSessionId,
          expiresAt: session.expiresAt,
        });
      })
      .catch(() => undefined)
      .finally(() => {
        creationPromise = undefined;
      });
  }, [clearSession, expiresAt, language, setSession, userSessionId]);
}
