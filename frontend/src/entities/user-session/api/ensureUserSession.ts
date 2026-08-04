import { createUserSession, updateUserSession } from '@/shared/api';
import { apiLanguageOf, type ApiLanguage } from '@/shared/i18n';
import { useUserSessionStore } from '../model/userSessionStore';
import { isUsableUserSession } from './parseUserSessionExpiry';

/** @deprecated `ApiLanguage`를 쓴다. 같은 타입을 두 곳에서 정의하지 않기 위해 별칭으로 남긴다. */
export type UserSessionLanguage = ApiLanguage;

/** 동시에 여러 화면이 세션을 요청해도 생성은 한 번만 한다. */
let creationPromise: Promise<string | null> | undefined;

/**
 * 사용 가능한 비로그인 세션을 보장한다.
 *
 * 저장된 세션이 살아 있으면 그대로 쓰고, 없거나 서버에서 사라졌으면 새로 만든다.
 * 실패하면 `null`을 반환한다 — 호출한 화면이 재시도 UI를 띄울 수 있어야 하므로
 * 예외를 삼키지 않고 결과로 알린다.
 *
 * 만료 판정은 `isUsableUserSession`(S15P11A206-341), 언어 정규화는 `apiLanguageOf`
 * (S15P11A206-339)가 맡는다. 이 파일에 있던 `isUsable`·`normalizeLanguage`는 각각 그것으로
 * 대체돼 지웠다.
 */
export async function ensureUserSession(language: string): Promise<string | null> {
  const { userSessionId, language: storedLanguage, expiresAt, pendingCurrentNodeId, setSession, clearSession } =
    useUserSessionStore.getState();
  const normalizedLanguage = apiLanguageOf(language) === 'en' ? 'en' : 'ko';

  if (userSessionId && isUsableUserSession(expiresAt)) {
    if (storedLanguage === null || storedLanguage === normalizedLanguage) return userSessionId;

    try {
      const session = await updateUserSession(userSessionId, { language: normalizedLanguage });
      setSession({
        userSessionId,
        language: normalizedLanguage,
        expiresAt: session.expiresAt ?? expiresAt,
        pendingCurrentNodeId,
      });
      return userSessionId;
    } catch {
      return null;
    }
  }

  if (userSessionId) {
    clearSession();
  }

  creationPromise ??= createUserSession({ language: normalizedLanguage })
    .then((session) => {
      if (!session.userSessionId) return null;
      setSession({ userSessionId: session.userSessionId, language: normalizedLanguage, expiresAt: session.expiresAt });
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
