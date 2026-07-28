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
  STAT_TILES,
  ISSUE_BREAKDOWN,
  LANGUAGE_BREAKDOWN,
  HOURLY_VOLUME,
  TOP_EXITS,
  AVERAGE_SATISFACTION,
} from './model/statsFixtures';
export type { StatTile, BarDatum, LanguageDatum } from './model/statsFixtures';
