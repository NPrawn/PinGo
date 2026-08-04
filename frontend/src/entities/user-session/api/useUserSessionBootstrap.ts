import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { getUserSession } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { useUserSessionStore } from '../model/userSessionStore';
import { syncPendingCurrentNode } from './syncCurrentNode';

/** 저장된 세션을 검증하고 최초 생성 시각 기준 만료 시점에 사용자 흐름을 초기화한다. */
export function useUserSessionBootstrap() {
  const navigate = useNavigate();
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const setExpiresAt = useUserSessionStore((state) => state.setExpiresAt);
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

    void getUserSession(userSessionId)
      .then((session) => {
        if (disposed) return;

        const expiresAt = session.expiresAt;
        if (!expiresAt) {
          expireSession();
          return;
        }

        const expiresAtMs = new Date(expiresAt).getTime();
        if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
          expireSession();
          return;
        }

        setExpiresAt(expiresAt);
        expiryTimer = window.setTimeout(expireSession, expiresAtMs - Date.now());
        void syncPendingCurrentNode();
      })
      .catch(() => {
        if (!disposed) expireSession();
      });

    return () => {
      disposed = true;
      if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
    };
  }, [clearConsultation, clearSession, navigate, setExpiresAt, userSessionId]);
}
