import { create } from 'zustand';

type ConsultStore = {
  /** Index into `CONSULT_ISSUES`, or null before the user picks one. */
  issue: number | null;
  /** 1–5 star rating collected when the consultation ends. */
  satisfaction: number;
  consultationId: string | null;
  signalingRoomId: string | null;
  selectIssue: (index: number) => void;
  rate: (score: number) => void;
  setConsultation: (consultationId: string) => void;
  setSignalingRoom: (signalingRoomId: string) => void;
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
export const useConsultStore = create<ConsultStore>((set) => ({
  issue: null,
  satisfaction: 0,
  consultationId: null,
  signalingRoomId: null,
  selectIssue: (issue) => set({ issue }),
  rate: (satisfaction) => set({ satisfaction }),
  setConsultation: (consultationId) => set({ consultationId }),
  setSignalingRoom: (signalingRoomId) => set({ signalingRoomId }),
  reset: () =>
    set({
      issue: null,
      satisfaction: 0,
      consultationId: null,
      signalingRoomId: null,
    }),
}));
