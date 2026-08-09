import { describe, expect, it } from 'vitest';
import type { CounselorConsultation } from '@/shared/api';
import { isConsultationAssignedToCounselor } from './counselorConsultationVisibility';

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

describe('counselor consultation ownership', () => {
  it('counselorId로 로그인 상담자에게 배정된 건인지 판별한다', () => {
    expect(isConsultationAssignedToCounselor(consultation('ACCEPTED', 7), 7)).toBe(true);
    expect(isConsultationAssignedToCounselor(consultation('IN_PROGRESS', 8), 7)).toBe(false);
    expect(isConsultationAssignedToCounselor(consultation('ENDED', 7))).toBe(false);
  });
});
