import { create } from 'zustand';

/** Where a queued request stands from the counselor's point of view. */
export type RequestStatus = 'waiting' | 'active' | 'done';

type CounselorQueueStore = {
  /** Index into `CONSULT_REQUESTS` the counselor is looking at. */
  selected: number;
  /** Status per request index; entries default to `waiting`. */
  statuses: Record<number, RequestStatus>;
  select: (index: number) => void;
  accept: (index: number) => void;
  complete: (index: number) => void;
  statusOf: (index: number) => RequestStatus;
};

/**
 * The counselor's request queue.
 *
 * Lives in a store rather than the requests page so accepting a request and
 * then walking through connecting → session → history keeps the queue in the
 * right state when the counselor comes back to the list.
 *
 * TODO: Replace with the consult queue API + realtime events once the
 * signalling contract is agreed; status transitions will then be server-driven.
 */
export const useCounselorQueueStore = create<CounselorQueueStore>((set, get) => ({
  selected: 0,
  statuses: {},
  select: (selected) => set({ selected }),
  accept: (index) => set((state) => ({ statuses: { ...state.statuses, [index]: 'active' } })),
  complete: (index) => set((state) => ({ statuses: { ...state.statuses, [index]: 'done' } })),
  statusOf: (index) => get().statuses[index] ?? 'waiting',
}));
