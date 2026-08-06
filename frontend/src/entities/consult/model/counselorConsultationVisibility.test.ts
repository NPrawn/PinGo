import { describe, expect, it } from 'vitest';
import type { CounselorConsultation } from '@/shared/api';
import {
  isActiveConsultationAssignedToCounselor,
  isConsultationAssignedToCounselor,
  isUnassignedWaitingConsultation,
} from './counselorConsultationVisibility';

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
  it('담당자가 없는 대기 상담만 수락 대상으로 보여 준다', () => {
    expect(isUnassignedWaitingConsultation(consultation('WAITING'))).toBe(true);
    expect(isUnassignedWaitingConsultation(consultation('WAITING', 8))).toBe(false);
    expect(isUnassignedWaitingConsultation(consultation('ACCEPTED'))).toBe(false);
  });

  it('counselorId로 로그인 상담자에게 배정된 건인지 판별한다', () => {
    expect(isConsultationAssignedToCounselor(consultation('ACCEPTED', 7), 7)).toBe(true);
    expect(isConsultationAssignedToCounselor(consultation('IN_PROGRESS', 8), 7)).toBe(false);
    expect(isConsultationAssignedToCounselor(consultation('ENDED', 7))).toBe(false);
  });

  it('내 상담 목록에는 진행성 상태의 본인 상담만 남긴다', () => {
    expect(isActiveConsultationAssignedToCounselor(consultation('ACCEPTED', 7), 7)).toBe(true);
    expect(isActiveConsultationAssignedToCounselor(consultation('IN_PROGRESS', 7), 7)).toBe(true);
    expect(isActiveConsultationAssignedToCounselor(consultation('IN_PROGRESS', 8), 7)).toBe(false);
    expect(isActiveConsultationAssignedToCounselor(consultation('ENDED', 7), 7)).toBe(false);
  });
});
