import type { CounselorConsultation } from '@/shared/api';

/** 아직 누구에게도 배정되지 않아 모든 상담자가 수락할 수 있는 대기 상담. */
export function isUnassignedWaitingConsultation(consultation: CounselorConsultation) {
  return consultation.status === 'WAITING' && consultation.counselorId == null;
}

/** 현재 로그인한 상담자에게 배정된 상담인지 판별한다. */
export function isConsultationAssignedToCounselor(
  consultation: CounselorConsultation,
  counselorAccountId?: number,
) {
  return counselorAccountId != null && consultation.counselorId === counselorAccountId;
}

/** 요청 목록의 '내 상담'에 표시할 진행성 상태만 남긴다. */
export function isActiveConsultationAssignedToCounselor(
  consultation: CounselorConsultation,
  counselorAccountId?: number,
) {
  return (
    (consultation.status === 'ACCEPTED' || consultation.status === 'IN_PROGRESS') &&
    isConsultationAssignedToCounselor(consultation, counselorAccountId)
  );
}
