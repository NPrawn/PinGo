import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../types';
import {
  getConsultationSummary,
  normalizeCounselorConsultationPage,
  type CounselorConsultation,
  type CounselorConsultationPage,
} from './counselorApi';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('../client', () => ({ apiClient: { get: mocks.get } }));

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

describe('getConsultationSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('요약 없음 404를 null 성공 결과로 정규화한다', async () => {
    mocks.get.mockRejectedValueOnce(
      new ApiError('요약을 찾을 수 없습니다.', {
        code: 'CONSULTATION_SUMMARY_NOT_FOUND',
        status: 404,
      }),
    );

    await expect(getConsultationSummary('cs_without_summary')).resolves.toBeNull();
  });

  it('요약 없음이 아닌 오류는 그대로 전파한다', async () => {
    const error = new ApiError('서버 오류', { code: 'INTERNAL_SERVER_ERROR', status: 500 });
    mocks.get.mockRejectedValueOnce(error);

    await expect(getConsultationSummary('cs_failed')).rejects.toBe(error);
  });
});
