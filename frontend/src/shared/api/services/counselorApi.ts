import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { unwrap } from '../request';
import type { components } from '../schema';

type Schemas = components['schemas'];

export type CounselorSelfAccount = Schemas['AccountDetailResponse'];
export type CounselorSelfUpdateRequest = Schemas['CounselorSelfUpdateRequest'];
export type CounselorConsultation = {
  consultationId: string;
  stationId: number;
  problemType: string;
  status: 'WAITING' | 'ACCEPTED' | 'IN_PROGRESS' | 'ENDED' | 'CANCELED' | 'REJECTED' | 'FAILED';
  currentNodeId?: number;
  currentLocationLabel?: string;
  destinationType?: string;
  destinationId?: number;
  destinationLabel?: string;
  requestedAt: string;
};

export function getCounselorConsultations(status?: CounselorConsultation['status']) {
  return unwrap<CounselorConsultation[]>(
    apiClient.get(ENDPOINTS.counselors.consultations, { params: { status } }),
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

/** 이미 수락한 상담에 다시 들어갈 때 signaling 토큰을 재발급받는다. */
export function issueConsultationSignalingToken(consultationId: string) {
  return unwrap<Schemas['ConsultationSignalingTokenResponse']>(
    apiClient.post(ENDPOINTS.consultations.signalingToken(consultationId)),
  );
}

export function endConsultation(consultationId: string) {
  return unwrap<Schemas['ConsultationResponse']>(
    apiClient.post(ENDPOINTS.consultations.end(consultationId)),
  );
}

export function getCounselorMe() {
  return unwrap<CounselorSelfAccount>(apiClient.get(ENDPOINTS.counselors.me));
}

export function updateCounselorMe(request: CounselorSelfUpdateRequest) {
  return unwrap<CounselorSelfAccount>(apiClient.patch(ENDPOINTS.counselors.me, request));
}
