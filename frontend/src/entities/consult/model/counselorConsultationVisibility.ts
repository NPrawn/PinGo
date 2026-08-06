import type { CounselorConsultation } from '@/shared/api';

/**
 * 상담자 콘솔에 노출해도 되는 상담인지 판별한다.
 *
 * 대기 상담은 아직 담당자가 없어야 수락할 수 있다. 그 밖의 상태는 현재 로그인한 상담자가
 * 배정된 건만 보여, 같은 역의 다른 상담자가 진행하거나 끝낸 상담에 들어가지 않게 한다.
 */
export function isCounselorConsultationVisible(
  consultation: CounselorConsultation,
  counselorAccountId?: number,
) {
  if (consultation.status === 'WAITING') return consultation.counselorId == null;
  return counselorAccountId != null && consultation.counselorId === counselorAccountId;
}
