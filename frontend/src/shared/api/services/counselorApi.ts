import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { unwrap } from '../request';
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
  'consultationId' | 'status' | 'requestedAt'
> & {
  consultationId: string;
  status: NonNullable<ConsultationListResponse['status']>;
  requestedAt: string;
};
export type CounselorConsultationDetail = Schemas['ConsultationDetailResponse'];

/** status를 비우면 담당 역의 모든 상담을 받는다. */
export function getCounselorConsultations(status?: CounselorConsultation['status']) {
  return unwrap<CounselorConsultation[]>(
    apiClient.get(ENDPOINTS.counselors.consultations, { params: { status } }),
  );
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

export function getCounselorMe() {
  return unwrap<CounselorSelfAccount>(apiClient.get(ENDPOINTS.counselors.me));
}

export function updateCounselorMe(request: CounselorSelfUpdateRequest) {
  return unwrap<CounselorSelfAccount>(apiClient.patch(ENDPOINTS.counselors.me, request));
}
