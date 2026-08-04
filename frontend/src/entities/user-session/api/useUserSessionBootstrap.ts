import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getUserSession } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { sessionExpiryMs } from '../lib/sessionExpiry';
import { useUserSessionStore } from '../model/userSessionStore';
import { syncPendingCurrentNode } from './syncCurrentNode';

/** 저장된 세션을 검증하고 최초 생성 시각 기준 만료 시점에 사용자 흐름을 초기화한다. */
export function useUserSessionBootstrap() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const expiresAt = useUserSessionStore((state) => state.expiresAt);
  const clearSession = useUserSessionStore((state) => state.clearSession);
  const setLanguage = useUserSessionStore((state) => state.setLanguage);

  useEffect(() => {
    const retryPendingSync = () => void syncPendingCurrentNode();
    window.addEventListener('online', retryPendingSync);
    return () => window.removeEventListener('online', retryPendingSync);
  }, []);

  useEffect(() => {
    if (!userSessionId) return;

    const expireSession = () => {
      clearSession();
      navigate(USER_ROUTES.SPLASH, { replace: true });
    };
    const expiresAtMs = sessionExpiryMs(expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      expireSession();
      return;
    }

    let disposed = false;
    const expiryTimer = window.setTimeout(expireSession, expiresAtMs - Date.now());

    void getUserSession(userSessionId)
      .then((session) => {
        if (disposed) return;
        const current = useUserSessionStore.getState();
        if (current.userSessionId !== userSessionId) return;
        const language = current.language ?? (session.language === 'en' ? 'en' : 'ko');
        setLanguage(language, session.expiresAt);
        void i18n.changeLanguage(language);
        void syncPendingCurrentNode();
      })
      .catch(() => {
        if (!disposed) expireSession();
      });

    return () => {
      disposed = true;
      window.clearTimeout(expiryTimer);
    };
  }, [clearSession, expiresAt, i18n, navigate, setLanguage, userSessionId]);
}
