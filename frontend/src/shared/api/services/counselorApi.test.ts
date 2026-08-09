import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../types';
import {
  getCounselorConsultationPage,
  getConsultationSummary,
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

describe('getCounselorConsultationPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('복수 상태와 내 상담 범위를 신형 페이지 API로 전달한다', async () => {
    const page: CounselorConsultationPage = {
      content: [consultation],
      page: 1,
      size: 10,
      totalElements: 21,
      totalPages: 3,
      first: false,
      last: false,
    };
    mocks.get.mockResolvedValueOnce({ data: { success: true, data: page } });

    await expect(
      getCounselorConsultationPage({
        statuses: ['ACCEPTED', 'IN_PROGRESS'],
        scope: 'MINE',
        page: 1,
        size: 10,
        sort: 'requestedAt,asc',
      }),
    ).resolves.toBe(page);
    expect(mocks.get).toHaveBeenCalledWith('/api/counselors/consultations', {
      params: {
        statuses: 'ACCEPTED,IN_PROGRESS',
        scope: 'MINE',
        page: 1,
        size: 10,
        sort: 'requestedAt,asc',
      },
    });
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
