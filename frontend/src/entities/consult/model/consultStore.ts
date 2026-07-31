import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ConsultStore = {
  /** Index into `CONSULT_ISSUES`, or null before the user picks one. */
  issue: number | null;
  /** 1–5 star rating collected when the consultation ends. */
  satisfaction: number;
  consultationId: string | null;
  signalingRoomId: string | null;
  /** Signaling WebSocket handshake token issued with the room. */
  signalingAccessToken: string | null;
  selectIssue: (index: number) => void;
  rate: (score: number) => void;
  setConsultation: (consultationId: string) => void;
  setSignalingRoom: (signalingRoomId: string, signalingAccessToken?: string | null) => void;
  reset: () => void;
};

/**
 * The user's consultation request.
 *
 * Crosses pages: the request screen picks the issue, the permission and waiting
 * screens carry it, and the end screen records satisfaction.
 *
 * The prototype reused its `landmark` field for the issue type, which coupled
 * the consult flow to the location-recognition flow; they are separate here.
 */
export const useConsultStore = create<ConsultStore>()(
  persist(
    (set) => ({
      issue: null,
      satisfaction: 0,
      consultationId: null,
      signalingRoomId: null,
      signalingAccessToken: null,
      selectIssue: (issue) => set({ issue }),
      rate: (satisfaction) => set({ satisfaction }),
      setConsultation: (consultationId) => set({ consultationId }),
      setSignalingRoom: (signalingRoomId, signalingAccessToken = null) =>
        set({ signalingRoomId, signalingAccessToken }),
      reset: () =>
        set({
          issue: null,
          satisfaction: 0,
          consultationId: null,
          signalingRoomId: null,
          signalingAccessToken: null,
        }),
    }),
    {
      name: 'pingo.consult',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
