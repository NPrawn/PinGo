import { create } from 'zustand';

/** Device capabilities PinGo asks for during onboarding. */
export type PermissionKey = 'loc' | 'cam' | 'mic';

export type PermissionState = Record<PermissionKey, boolean>;

type PermissionStore = {
  granted: PermissionState;
  toggle: (key: PermissionKey) => void;
  grant: (...keys: PermissionKey[]) => void;
  hasAll: (...keys: PermissionKey[]) => boolean;
};

/**
 * Which permissions the user has agreed to.
 *
 * Crosses pages: the onboarding permission screen sets it, the consult flow
 * reads it to decide whether it can start a call.
 *
 * TODO: This mirrors the prototype's opt-in checkboxes. Replace with the real
 * Permissions API / getUserMedia results once the browser support matrix and
 * fallback behaviour are agreed.
 */
export const usePermissionStore = create<PermissionStore>((set, get) => ({
  granted: { loc: false, cam: false, mic: false },
  toggle: (key) => set((state) => ({ granted: { ...state.granted, [key]: !state.granted[key] } })),
  grant: (...keys) =>
    set((state) => ({
      granted: keys.reduce((acc, key) => ({ ...acc, [key]: true }), state.granted),
    })),
  hasAll: (...keys) => keys.every((key) => get().granted[key]),
}));
