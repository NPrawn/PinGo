const AUTH_SESSION_KEY = 'pingo.auth';

export type AuthSession = {
  accessToken: string;
  accountType: 'COUNSELOR' | 'ADMIN';
  accountId: number;
  name: string;
  stationId?: number;
  status?: 'AVAILABLE' | 'BUSY' | 'OFFLINE';
};

export function getAuthSession(): AuthSession | null {
  const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export function setAuthSession(session: AuthSession) {
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}

export function getAccessToken() {
  return getAuthSession()?.accessToken;
}
