import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserSession } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { useUserSessionStore } from '../model/userSessionStore';
import { syncPendingCurrentNode } from './syncCurrentNode';

/** 저장된 세션을 검증하고 최초 생성 시각 기준 만료 시점에 사용자 흐름을 초기화한다. */
export function useUserSessionBootstrap() {
  const navigate = useNavigate();
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const expiresAt = useUserSessionStore((state) => state.expiresAt);
  const clearSession = useUserSessionStore((state) => state.clearSession);

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
    const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : Number.NaN;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      expireSession();
      return;
    }

    let disposed = false;
    const expiryTimer = window.setTimeout(expireSession, expiresAtMs - Date.now());

    void getUserSession(userSessionId)
      .then(() => {
        if (!disposed) void syncPendingCurrentNode();
      })
      .catch(() => {
        if (!disposed) expireSession();
      });

    return () => {
      disposed = true;
      window.clearTimeout(expiryTimer);
    };
  }, [clearSession, expiresAt, navigate, userSessionId]);
}
