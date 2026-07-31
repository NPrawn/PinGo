export {
  CONSULT_REQUESTS,
  CONSULT_HISTORY,
  CONSULT_ISSUES,
  speakerColor,
  SATISFACTION_LABELS,
} from './model/fixtures';
export type { ConsultRequest, ConsultHistoryEntry, ConsultLogEntry } from './model/types';
export { useConsultStore } from './model/consultStore';
export { useCounselorQueueStore } from './model/counselorQueueStore';
export type { RequestStatus } from './model/counselorQueueStore';
