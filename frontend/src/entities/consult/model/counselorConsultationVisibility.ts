import type { CounselorConsultation } from '@/shared/api';

/** 현재 로그인한 상담자에게 배정된 상담인지 판별한다. */
export function isConsultationAssignedToCounselor(
  consultation: CounselorConsultation,
  counselorAccountId?: number,
) {
  return counselorAccountId != null && consultation.counselorId === counselorAccountId;
}
