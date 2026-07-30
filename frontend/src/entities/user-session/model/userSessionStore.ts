import { create } from 'zustand';

const STORAGE_KEY = 'pingo.user-session';

type StoredSession = {
  userSessionId: string;
  expiresAt?: string;
};

function readStoredSession(): StoredSession | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    return value ? (JSON.parse(value) as StoredSession) : null;
  } catch {
    return null;
  }
}

type UserSessionStore = {
  userSessionId: string | null;
  expiresAt?: string;
  setSession: (session: StoredSession) => void;
  clearSession: () => void;
};

const storedSession = readStoredSession();

export const useUserSessionStore = create<UserSessionStore>((set) => ({
  userSessionId: storedSession?.userSessionId ?? null,
  expiresAt: storedSession?.expiresAt,
  setSession: (session) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    set(session);
  },
  clearSession: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    set({ userSessionId: null, expiresAt: undefined });
  },
}));
