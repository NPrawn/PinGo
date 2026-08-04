import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { ApiError, getUserSession } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { useUserSessionStore } from '../model/userSessionStore';
import { parseUserSessionExpiry } from './parseUserSessionExpiry';
import { syncPendingCurrentNode } from './syncCurrentNode';

/** 저장된 세션을 검증하고 최초 생성 시각 기준 만료 시점에 사용자 흐름을 초기화한다. */
export function useUserSessionBootstrap() {
  const navigate = useNavigate();
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const setExpiresAt = useUserSessionStore((state) => state.setExpiresAt);
  const setLanguage = useUserSessionStore((state) => state.setLanguage);
  const clearSession = useUserSessionStore((state) => state.clearSession);
  const clearConsultation = useConsultStore((state) => state.clearConsultation);

  useEffect(() => {
    const retryPendingSync = () => void syncPendingCurrentNode();
    window.addEventListener('online', retryPendingSync);
    return () => window.removeEventListener('online', retryPendingSync);
  }, []);

  useEffect(() => {
    if (!userSessionId) return;

    const expireSession = () => {
      clearSession();
      clearConsultation();
      navigate(USER_ROUTES.SPLASH, { replace: true });
    };

    let disposed = false;
    let expiryTimer: number | undefined;
    const languageAtRequest = useUserSessionStore.getState().language;
    const scheduleExpiry = (expiresAtMs: number) => {
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
      expiryTimer = window.setTimeout(expireSession, Math.max(0, expiresAtMs - Date.now()));
    };

    const storedExpiresAtMs = parseUserSessionExpiry(useUserSessionStore.getState().expiresAt);
    if (storedExpiresAtMs !== null && storedExpiresAtMs > Date.now()) {
      scheduleExpiry(storedExpiresAtMs);
    }

    void getUserSession(userSessionId)
      .then((session) => {
        if (disposed) return;

        const expiresAt = session.expiresAt;
        if (!expiresAt) {
          expireSession();
          return;
        }

        const expiresAtMs = parseUserSessionExpiry(expiresAt);
        if (expiresAtMs === null || expiresAtMs <= Date.now()) {
          expireSession();
          return;
        }

        setExpiresAt(expiresAt);
        const currentLanguage = useUserSessionStore.getState().language;
        if (
          currentLanguage === languageAtRequest &&
          (session.language === 'ko' || session.language === 'en')
        ) {
          setLanguage(session.language);
        }
        scheduleExpiry(expiresAtMs);
        void syncPendingCurrentNode();
      })
      .catch((error: unknown) => {
        if (disposed) return;
        if (error instanceof ApiError && error.code === 'USER_SESSION_NOT_FOUND') {
          expireSession();
        }
      });

    return () => {
      disposed = true;
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    };
  }, [clearConsultation, clearSession, navigate, setExpiresAt, setLanguage, userSessionId]);
}
