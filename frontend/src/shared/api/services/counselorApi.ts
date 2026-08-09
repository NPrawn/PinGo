import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { unwrap } from '../request';
import { ApiError } from '../types';
import type { components } from '../schema';

type Schemas = components['schemas'];

export type CounselorSelfAccount = Schemas['AccountDetailResponse'];
export type CounselorSelfUpdateRequest = Schemas['CounselorSelfUpdateRequest'];
type ConsultationListResponse = Schemas['ConsultationListResponse'];

/**
 * 생성된 스키마는 모든 필드를 optional로 내보내지만, 서버는 식별자·상태·요청 시각을
 * 항상 채운다. 화면마다 방어 코드를 넣지 않도록 그 세 필드만 필수로 좁힌다.
 */
export type CounselorConsultation = Omit<
  ConsultationListResponse,
  'consultationId' | 'status' | 'requestedAt' | 'counselorId'
> & {
  consultationId: string;
  status: NonNullable<ConsultationListResponse['status']>;
  requestedAt: string;
  counselorId?: number | null;
  counselorName?: string | null;
  summaryStatus?: 'PENDING' | 'COMPLETED' | 'FAILED' | null;
  summaryPreview?: string | null;
};
export type CounselorConsultationListParams = {
  status?: CounselorConsultation['status'];
  statuses?: readonly CounselorConsultation['status'][];
  scope?: 'ALL' | 'MINE';
  page?: number;
  size?: number;
  sort?: string;
};
export type CounselorConsultationPage = {
  content: CounselorConsultation[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
};
export type CounselorConsultationDetail = Schemas['ConsultationDetailResponse'];
export type ConsultationTranscriptRequest = Schemas['ConsultationTranscriptRequest'];
export type ConsultationTranscriptSegment = Schemas['TranscriptSegmentRequest'];
export type ConsultationSummary = Schemas['ConsultationSummaryResponse'];
export type ConsultationSummaryStatus = Schemas['ConsultationSummaryStatusResponse'];

/** 범위·상태·페이지 조건으로 신형 상담 목록 페이지를 조회한다. */
export async function getCounselorConsultationPage(params: CounselorConsultationListParams = {}) {
  const { statuses, ...rest } = params;
  return unwrap<CounselorConsultationPage>(
    apiClient.get(ENDPOINTS.counselors.consultations, {
      params: {
        ...rest,
        statuses: statuses?.join(','),
      },
    }),
  );
}

/**
 * 연결·상담 화면이 현재 상담을 찾을 때 쓰는 기존 전체 목록 인터페이스.
 *
 * 목록 화면은 범위별 서버 페이지를 직접 사용하고, 연결 화면의 상태 감시만 최근 목록을 사용한다.
 */
export async function getCounselorConsultations(status?: CounselorConsultation['status']) {
  const page = await getCounselorConsultationPage({
    status,
    scope: 'MINE',
    page: 0,
    size: 100,
    sort: 'requestedAt,desc',
  });
  return page.content;
}

/** 상세 조회는 배정된 상담자에게 signaling room·토큰까지 함께 준다. */
export function getCounselorConsultation(consultationId: string) {
  return unwrap<CounselorConsultationDetail>(
    apiClient.get(ENDPOINTS.counselors.consultation(consultationId)),
  );
}

export function acceptConsultation(consultationId: string) {
  return unwrap<Schemas['ConsultationResponse']>(
    apiClient.post(ENDPOINTS.consultations.accept(consultationId)),
  );
}

export function rejectConsultation(consultationId: string) {
  return unwrap<Schemas['ConsultationResponse']>(
    apiClient.post(ENDPOINTS.consultations.reject(consultationId)),
  );
}

export function endConsultation(consultationId: string) {
  return unwrap<Schemas['ConsultationEndResponse']>(
    apiClient.post(ENDPOINTS.consultations.end(consultationId), { endedBy: 'counselor' }),
  );
}

/**
 * 상담 전문을 저장한다. 서버는 이 요청을 받은 뒤 AI 요약을 비동기로 만들기 때문에
 * 응답은 요약 본문이 아니라 생성 상태(`PENDING`)만 돌려준다.
 *
 * 상담이 `ENDED`가 된 뒤에만 받는다. 종료 요청보다 먼저 보내면 409로 거절된다.
 */
export function submitConsultationTranscript(
  consultationId: string,
  request: ConsultationTranscriptRequest,
) {
  return unwrap<ConsultationSummaryStatus>(
    apiClient.post(ENDPOINTS.consultations.transcript(consultationId), request),
  );
}

/**
 * 요약이 아직 없는 404는 이력 조회의 정상적인 빈 결과다.
 *
 * 오류 상태로 캐시하면 화면을 다시 열거나 포커스할 때마다 같은 GET이 반복된다. null을
 * 성공 결과로 돌려줘 화면이 요약 없음을 안정적으로 캐시하게 한다.
 */
export async function getConsultationSummary(consultationId: string) {
  try {
    return await unwrap<ConsultationSummary>(
      apiClient.get(ENDPOINTS.consultations.summary(consultationId)),
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.code === 'CONSULTATION_SUMMARY_NOT_FOUND' || error.status === 404)
    ) {
      return null;
    }
    throw error;
  }
}

export function getCounselorMe() {
  return unwrap<CounselorSelfAccount>(apiClient.get(ENDPOINTS.counselors.me));
}

export function updateCounselorMe(request: CounselorSelfUpdateRequest) {
  return unwrap<CounselorSelfAccount>(apiClient.patch(ENDPOINTS.counselors.me, request));
}
