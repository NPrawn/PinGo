import { useEffect, useState } from 'react';
import { ensureUserSession } from './ensureUserSession';

const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 2000;

/**
 * 사용자 화면에 들어오면 비로그인 세션을 준비한다.
 *
 * 생성이 실패하면 몇 번 자동으로 다시 시도한다. 재시도가 없으면 통신 실패 한 번으로
 * 세션이 영구히 비어 있고, 세션을 요구하는 화면(상담 요청 등)이 잠긴다.
 */
export function useUserSessionBootstrap(language: string) {
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false;
    let retryTimer: number | undefined;

    void ensureUserSession(language).then((userSessionId) => {
      if (disposed || userSessionId || attempt >= RETRY_LIMIT) return;
      retryTimer = window.setTimeout(
        () => setAttempt((current) => current + 1),
        RETRY_DELAY_MS * (attempt + 1),
      );
    });

    return () => {
      disposed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
    };
  }, [attempt, language]);
}
