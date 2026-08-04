import { create } from 'zustand';

const STORAGE_KEY = 'pingo.user-session';

type StoredSession = {
  userSessionId: string;
  language?: 'ko' | 'en';
  expiresAt?: string;
  pendingCurrentNodeId?: number;
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
  language: 'ko' | 'en' | null;
  expiresAt?: string;
  pendingCurrentNodeId?: number;
  setSession: (session: StoredSession) => void;
  setLanguage: (language: 'ko' | 'en') => void;
  setExpiresAt: (expiresAt: string) => void;
  setPendingCurrentNodeId: (currentNodeId: number) => void;
  clearPendingCurrentNodeId: (currentNodeId: number) => void;
  clearSession: () => void;
};

const storedSession = readStoredSession();

export const useUserSessionStore = create<UserSessionStore>((set) => ({
  userSessionId: storedSession?.userSessionId ?? null,
  language: storedSession?.language ?? null,
  expiresAt: storedSession?.expiresAt,
  pendingCurrentNodeId: storedSession?.pendingCurrentNodeId,
  setSession: (session) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    set({ ...session, pendingCurrentNodeId: undefined });
  },
  setExpiresAt: (expiresAt) =>
    set((state) => {
      if (!state.userSessionId) return state;
      const next = {
        userSessionId: state.userSessionId,
        language: state.language ?? undefined,
        expiresAt,
        pendingCurrentNodeId: state.pendingCurrentNodeId,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    }),
  setLanguage: (language) =>
    set((state) => {
      const next = { ...state, language };
      if (state.userSessionId) {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            userSessionId: state.userSessionId,
            language,
            expiresAt: state.expiresAt,
            pendingCurrentNodeId: state.pendingCurrentNodeId,
          }),
        );
      }
      return next;
    }),
  setPendingCurrentNodeId: (pendingCurrentNodeId) =>
    set((state) => {
      if (!state.userSessionId) return state;
      const next = {
        userSessionId: state.userSessionId,
        language: state.language ?? undefined,
        expiresAt: state.expiresAt,
        pendingCurrentNodeId,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    }),
  clearPendingCurrentNodeId: (currentNodeId) =>
    set((state) => {
      if (state.pendingCurrentNodeId !== currentNodeId) return state;
      const next = {
        userSessionId: state.userSessionId,
        language: state.language ?? undefined,
        expiresAt: state.expiresAt,
        pendingCurrentNodeId: undefined,
      };
      if (next.userSessionId) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    }),
  clearSession: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    set({ userSessionId: null, language: null, expiresAt: undefined, pendingCurrentNodeId: undefined });
  },
}));
