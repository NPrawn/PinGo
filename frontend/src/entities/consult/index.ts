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
export {
  CLOSED_CONSULTATION_STATUSES,
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_PROBLEM_LABELS,
  consultationStatusLabel,
  consultationProblemLabel,
  isClosedConsultation,
} from './model/statusLabels';
export {
  consultationDateTimeLabel,
  consultationRef,
  destinationTypeLabel,
  waitedLabel,
} from './model/format';
export { useCounselorConsultations } from './model/useCounselorConsultation';
export {
  isActiveConsultationAssignedToCounselor,
  isConsultationAssignedToCounselor,
  isUnassignedWaitingConsultation,
} from './model/counselorConsultationVisibility';
