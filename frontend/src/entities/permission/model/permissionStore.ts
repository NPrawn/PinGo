import { create } from 'zustand';

/** Device capabilities PinGo asks for during onboarding. */
export type PermissionKey = 'loc' | 'cam' | 'mic';

export type PermissionState = Record<PermissionKey, boolean>;

type PermissionStore = {
  granted: PermissionState;
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
 * 값은 브라우저가 정한다. 화면이 임의로 켜고 끄지 않는다 — 권한을 실제로 바꿀 수 있는 곳은
 * 브라우저 설정뿐이라, 여기서 뒤집으면 화면만 허용됐다고 말하고 다음 단계에서 다시 막힌다.
 * 온보딩 화면(U-02)과 경로 가드가 실제 조회 결과를 `sync`로 넣는다.
 */
export const usePermissionStore = create<PermissionStore>((set, get) => ({
  granted: { loc: false, cam: false, mic: false },
  grant: (...keys) =>
    set((state) => ({
      granted: keys.reduce((acc, key) => ({ ...acc, [key]: true }), state.granted),
    })),
  sync: (next) => set({ granted: { ...next } }),
  hasAll: (...keys) => keys.every((key) => get().granted[key]),
}));
