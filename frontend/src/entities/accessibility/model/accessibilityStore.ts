import { create } from 'zustand';

type AccessibilityStore = {
  /** Read navigation instructions aloud. */
  voice: boolean;
  /** Larger type across the app. */
  bigText: boolean;
  /** Prefer step-free routes. */
  noStair: boolean;
  toggleVoice: () => void;
  toggleBigText: () => void;
  toggleNoStair: () => void;
};

/**
 * Accessibility preferences from the settings screen.
 *
 * Crosses pages: settings writes them, navigation and route selection read them.
 *
 * TODO: Persist these once the storage decision (localStorage vs. account
 * profile) is made — the prototype reset them on reload.
 */
export const useAccessibilityStore = create<AccessibilityStore>((set) => ({
  voice: true,
  bigText: false,
  noStair: false,
  toggleVoice: () => set((state) => ({ voice: !state.voice })),
  toggleBigText: () => set((state) => ({ bigText: !state.bigText })),
  toggleNoStair: () => set((state) => ({ noStair: !state.noStair })),
}));
