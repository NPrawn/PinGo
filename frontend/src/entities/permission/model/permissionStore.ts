import { create } from 'zustand';

/** Device capabilities PinGo asks for during onboarding. */
export type PermissionKey = 'loc' | 'cam' | 'mic';

export type PermissionState = Record<PermissionKey, boolean>;

type PermissionStore = {
  granted: PermissionState;
  toggle: (key: PermissionKey) => void;
  grant: (...keys: PermissionKey[]) => void;
  /**
   * Replaces every permission at once.
   *
   * `grant` only ever turns permissions on, so it cannot express a permission
   * the user revoked between two requests. The onboarding screen reports the
   * browser's answer for all three at once and uses this instead.
   */
  sync: (next: PermissionState) => void;
  hasAll: (...keys: PermissionKey[]) => boolean;
};

/**
 * Which permissions the user has agreed to.
 *
 * Crosses pages: the onboarding permission screen sets it, the consult flow
 * reads it to decide whether it can start a call.
 *
 * The onboarding screen (U-02) feeds this from the real browser permission
 * results through `sync`.
 *
 * TODO: The consult and settings screens still toggle these by hand, mirroring
 * the prototype's opt-in checkboxes. Point them at the browser results too once
 * their fallback behaviour is agreed.
 */
export const usePermissionStore = create<PermissionStore>((set, get) => ({
  granted: { loc: false, cam: false, mic: false },
  toggle: (key) => set((state) => ({ granted: { ...state.granted, [key]: !state.granted[key] } })),
  grant: (...keys) =>
    set((state) => ({
      granted: keys.reduce((acc, key) => ({ ...acc, [key]: true }), state.granted),
    })),
  sync: (next) => set({ granted: { ...next } }),
  hasAll: (...keys) => keys.every((key) => get().granted[key]),
}));
