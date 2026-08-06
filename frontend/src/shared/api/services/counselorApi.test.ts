import { describe, expect, it } from 'vitest';
import {
  normalizeCounselorConsultationPage,
  type CounselorConsultation,
  type CounselorConsultationPage,
} from './counselorApi';

const consultation: CounselorConsultation = {
  consultationId: 'cs_1',
  status: 'WAITING',
  requestedAt: '2026-08-06T00:00:00Z',
};

describe('normalizeCounselorConsultationPage', () => {
  it('구형 배열 응답을 한 페이지로 변환한다', () => {
    expect(normalizeCounselorConsultationPage([consultation])).toEqual({
      content: [consultation],
      page: 0,
      size: 1,
      totalElements: 1,
      totalPages: 1,
      first: true,
      last: true,
    });
  });

  it('구형 빈 배열 응답은 빈 페이지로 변환한다', () => {
    expect(normalizeCounselorConsultationPage([])).toEqual({
      content: [],
      page: 0,
      size: 0,
      totalElements: 0,
      totalPages: 0,
      first: true,
      last: true,
    });
  });

  it('신형 페이지 응답의 메타데이터를 유지한다', () => {
    const page: CounselorConsultationPage = {
      content: [consultation],
      page: 1,
      size: 10,
      totalElements: 21,
      totalPages: 3,
      first: false,
      last: false,
    };

    expect(normalizeCounselorConsultationPage(page)).toBe(page);
  });
});
