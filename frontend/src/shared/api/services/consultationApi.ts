import { env } from '@/shared/config';
import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { unwrap, unwrapVoid } from '../request';
import type { components } from '../schema';

type Schemas = components['schemas'];

export type ConsultationCreateRequest = Schemas['ConsultationCreateRequest'];
export type ConsultationCreateResponse = Schemas['ConsultationCreateResponse'];
export type ConsultationResponse = Schemas['ConsultationResponse'];
export type ConsultationCancelResponse = Schemas['ConsultationCancelResponse'];
export type ConsultationFallbackEventRequest = Schemas['ConsultationFallbackEventRequest'];

export function createConsultation(request: ConsultationCreateRequest) {
  return unwrap<ConsultationCreateResponse>(apiClient.post(ENDPOINTS.consultations.root, request));
}

export function getConsultation(consultationSessionId: string, userSessionId: string) {
  return unwrap<ConsultationResponse>(
    apiClient.get(ENDPOINTS.consultations.detail(consultationSessionId), {
      params: { userSessionId },
    }),
  );
}

export function cancelConsultation(consultationSessionId: string, userSessionId: string) {
  return unwrap<ConsultationCancelResponse>(
    apiClient.delete(ENDPOINTS.consultations.detail(consultationSessionId), {
      params: { userSessionId },
    }),
  );
}

export function publishConsultationFallbackEvent(
  consultationRequestId: string,
  request: ConsultationFallbackEventRequest,
) {
  return unwrapVoid(
    apiClient.post(ENDPOINTS.consultations.fallbackEvents(consultationRequestId), request),
  );
}

export function subscribeToConsultationWaitingEvents(consultationRequestId: string) {
  const baseUrl = env.VITE_API_BASE_URL.replace(/\/$/, '');
  return new EventSource(
    `${baseUrl}${ENDPOINTS.consultations.waitingEvents(consultationRequestId)}`,
  );
}
