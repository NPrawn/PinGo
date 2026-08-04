import { createUserSession, updateUserSession } from '@/shared/api';
import { sessionExpiryMs } from '../lib/sessionExpiry';
import { useUserSessionStore } from '../model/userSessionStore';

export type UserSessionLanguage = 'ko' | 'en' | 'ja' | 'zh';

const SUPPORTED: readonly string[] = ['ko', 'en', 'ja', 'zh'];

/** 동시에 여러 화면이 세션을 요청해도 생성은 한 번만 한다. */
let creationPromise: Promise<string | null> | undefined;

function isUsable(expiresAt?: string) {
  return !expiresAt || sessionExpiryMs(expiresAt) > Date.now();
}

function normalizeLanguage(language: string): UserSessionLanguage {
  const base = language.slice(0, 2).toLowerCase();
  return (SUPPORTED.includes(base) ? base : 'ko') as UserSessionLanguage;
}

/**
 * 사용 가능한 비로그인 세션을 보장한다.
 *
 * 저장된 세션이 살아 있으면 그대로 쓰고, 없거나 서버에서 사라졌으면 새로 만든다.
 * 실패하면 `null`을 반환한다 — 호출한 화면이 재시도 UI를 띄울 수 있어야 하므로
 * 예외를 삼키지 않고 결과로 알린다.
 */
export async function ensureUserSession(language: string): Promise<string | null> {
  const { userSessionId, expiresAt, setSession, setLanguage, clearSession } =
    useUserSessionStore.getState();
  const requestedLanguage = normalizeLanguage(language);

  if (userSessionId && isUsable(expiresAt)) {
    try {
      const session = await updateUserSession(userSessionId, { language: requestedLanguage });
      setLanguage(requestedLanguage as 'ko' | 'en', session.expiresAt);
      return userSessionId;
    } catch {
      clearSession();
    }
  } else if (userSessionId) {
    clearSession();
  }

  creationPromise ??= createUserSession({ language: requestedLanguage })
    .then((session) => {
      if (!session.userSessionId) return null;
      setSession({
        userSessionId: session.userSessionId,
        language: requestedLanguage as 'ko' | 'en',
        expiresAt: session.expiresAt,
      });
      return session.userSessionId;
    })
    .finally(() => {
      creationPromise = undefined;
    });

  try {
    return await creationPromise;
  } catch {
    return null;
  }
}
