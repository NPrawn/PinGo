import { create } from 'zustand';

const STORAGE_KEY = 'pingo.user-session';

type StoredSession = {
  userSessionId: string;
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
  expiresAt?: string;
  pendingCurrentNodeId?: number;
  setSession: (session: StoredSession) => void;
  setExpiresAt: (expiresAt: string) => void;
  setPendingCurrentNodeId: (currentNodeId: number) => void;
  clearPendingCurrentNodeId: (currentNodeId: number) => void;
  clearSession: () => void;
};

const storedSession = readStoredSession();

export const useUserSessionStore = create<UserSessionStore>((set) => ({
  userSessionId: storedSession?.userSessionId ?? null,
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
        expiresAt,
        pendingCurrentNodeId: state.pendingCurrentNodeId,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    }),
  setPendingCurrentNodeId: (pendingCurrentNodeId) =>
    set((state) => {
      if (!state.userSessionId) return state;
      const next = {
        userSessionId: state.userSessionId,
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
        expiresAt: state.expiresAt,
        pendingCurrentNodeId: undefined,
      };
      if (next.userSessionId) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    }),
  clearSession: () => {
    sessionStorage.removeItem(STORAGE_KEY);
    set({ userSessionId: null, expiresAt: undefined, pendingCurrentNodeId: undefined });
  },
}));
