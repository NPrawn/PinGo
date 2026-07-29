import { create } from 'zustand';

type ConsultStore = {
  /** Index into `CONSULT_ISSUES`, or null before the user picks one. */
  issue: number | null;
  /** 1–5 star rating collected when the consultation ends. */
  satisfaction: number;
  selectIssue: (index: number) => void;
  rate: (score: number) => void;
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
  selectIssue: (issue) => set({ issue }),
  rate: (satisfaction) => set({ satisfaction }),
  reset: () => set({ issue: null, satisfaction: 0 }),
}));
