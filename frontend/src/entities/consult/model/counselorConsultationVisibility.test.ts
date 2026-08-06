import { describe, expect, it } from 'vitest';
import type { CounselorConsultation } from '@/shared/api';
import { isCounselorConsultationVisible } from './counselorConsultationVisibility';

function consultation(
  status: CounselorConsultation['status'],
  counselorId?: number,
): CounselorConsultation {
  return {
    consultationId: `cs_${status}`,
    status,
    counselorId,
    requestedAt: '2026-08-06T00:00:00Z',
  };
}

describe('isCounselorConsultationVisible', () => {
  it('담당자가 없는 대기 상담만 수락 대상으로 보여 준다', () => {
    expect(isCounselorConsultationVisible(consultation('WAITING'), 7)).toBe(true);
    expect(isCounselorConsultationVisible(consultation('WAITING', 8), 7)).toBe(false);
  });

  it('배정된 상담은 로그인한 상담자 본인에게만 보여 준다', () => {
    expect(isCounselorConsultationVisible(consultation('ACCEPTED', 7), 7)).toBe(true);
    expect(isCounselorConsultationVisible(consultation('IN_PROGRESS', 8), 7)).toBe(false);
    expect(isCounselorConsultationVisible(consultation('ENDED', 7), 7)).toBe(true);
  });

  it('로그인 상담자 ID를 확인하기 전에는 배정 상담을 노출하지 않는다', () => {
    expect(isCounselorConsultationVisible(consultation('ACCEPTED', 7))).toBe(false);
  });
});
