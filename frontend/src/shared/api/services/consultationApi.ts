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
export type ConsultationEndResponse = Schemas['ConsultationEndResponse'];
export type ConsultationFallbackEventRequest = Schemas['ConsultationFallbackEventRequest'];
/**
 * 만족도 평가 응답. 서버가 `ConsultationRatingRequest.Response` 중첩 레코드로 선언해
 * 생성된 스키마 이름이 `Response`가 됐다. 이름만으로는 무엇인지 알 수 없어 여기서 감싼다.
 */
export type ConsultationRatingResponse = Schemas['Response'];

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

/**
 * 사용자가 상담을 끝낸다. 상담자 쪽 종료(`endConsultation`)와 달리 JWT가 없어
 * 소유자 확인에 `userSessionId`가 필요하다.
 */
export function endConsultationByUser(consultationSessionId: string, userSessionId: string) {
  return unwrap<ConsultationEndResponse>(
    apiClient.post(ENDPOINTS.consultations.end(consultationSessionId), {
      endedBy: 'user',
      userSessionId,
    }),
  );
}

/** 만족도 평가는 종료된 상담에 한 번만 매길 수 있다. 점수는 1~5다. */
export function rateConsultation(
  consultationId: string,
  userSessionId: string,
  score: number,
): Promise<ConsultationRatingResponse> {
  return unwrap<ConsultationRatingResponse>(
    apiClient.post(ENDPOINTS.consultations.rating(consultationId), { userSessionId, score }),
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

/**
 * DataChannel 우회 이벤트 요청.
 *
 * 생성된 스키마의 `payload` 는 Jackson 이 들여다본 `JsonNode` 의 내부 모양(`array`,
 * `nodeType` …)으로 나와 있어 실제로 보낼 값과 맞지 않는다. 서버는 임의의 JSON 을 그대로
 * 받아 되돌려 주므로 여기서 쓸 수 있는 형태로 다시 적는다.
 */
export type ConsultationDataChannelEventRequest = {
  type: Schemas['ConsultationDataChannelEventRequest']['type'];
  payload?: unknown;
};

/**
 * DataChannel 이 열리지 않았을 때 상담 이벤트를 서버를 거쳐 상대에게 보낸다.
 *
 * 서버는 받은 이벤트를 상담 SSE 스트림(`waiting-events`)에 `DATA_CHANNEL` 이름으로 되뿌린다.
 */
export function publishConsultationDataChannelEvent(
  consultationRequestId: string,
  request: ConsultationDataChannelEventRequest,
) {
  return unwrapVoid(
    apiClient.post(ENDPOINTS.consultations.dataChannelEvents(consultationRequestId), request),
  );
}

export type IceServersResponse = Schemas['IceServersResponse'];

/**
 * WebRTC 연결에 쓸 STUN·TURN 서버 목록.
 *
 * TURN 자격증명은 서버가 시간 제한으로 발급하므로 프론트에 박아 둘 수 없다. 서로 다른
 * 망에 있는 사용자와 상담자를 잇는 데 필요하다.
 *
 * 로그인 토큰이 아니라 상담마다 발급되는 signaling 토큰으로 확인한다. 상담 참여자인지를
 * 보는 API 라서 상담자·사용자가 같은 방식으로 쓴다. 로그인 토큰을 실으면 서버가 해석하지
 * 못해 401 이 나고, 그 401 로 상담자 로그인이 풀린다.
 */
export function getIceServers(signalingAccessToken: string) {
  return unwrap<IceServersResponse>(
    apiClient.get(ENDPOINTS.webrtc.iceServers, {
      params: { token: signalingAccessToken },
      skipAuth: true,
    } as Parameters<typeof apiClient.get>[1]),
  );
}

/**
 * 실시간 자막 한 줄을 상대 언어로 옮긴다.
 *
 * 서버는 옮기지 못하면 원문을 그대로 돌려주고 `translated: false` 로 알린다. 번역 하나가
 * 실패했다고 자막까지 사라지면 안 되기 때문이다.
 *
 * 스키마가 아직 이 응답을 담고 있지 않아 형태를 여기 적는다.
 */
export type ConsultationTranslation = {
  text: string;
  targetLanguage: string;
  translated: boolean;
};

export function translateConsultationCaption(
  consultationId: string,
  request: { text: string; targetLanguage: string },
) {
  return unwrap<ConsultationTranslation>(
    apiClient.post(ENDPOINTS.consultations.translate(consultationId), request),
  );
}

/**
 * 녹음한 발화 한 토막을 글로 옮긴다.
 *
 * 브라우저 음성 인식은 `getUserMedia` 와 마이크를 다툰다. 안드로이드에서는 통화 캡처가
 * 이기고 인식기가 죽는데, 목소리는 멀쩡히 오가니 그쪽 발화만 조용히 전문에서 빠진다.
 * 이 길은 이미 열려 있는 트랙을 녹음해 보내므로 그 다툼이 없다.
 *
 * 알아듣지 못하면 빈 글이 온다. 오류가 아니다 — 숨소리나 지나가는 소음만 담긴 조각은 흔하다.
 */
export type ConsultationTranscription = {
  text: string;
};

export function transcribeConsultationAudio(
  consultationId: string,
  request: { audio: string; mimeType: string; language?: string },
) {
  return unwrap<ConsultationTranscription>(
    apiClient.post(ENDPOINTS.consultations.transcribe(consultationId), request),
  );
}

export function subscribeToConsultationWaitingEvents(consultationRequestId: string) {
  const baseUrl = env.VITE_API_BASE_URL.replace(/\/$/, '');
  return new EventSource(
    `${baseUrl}${ENDPOINTS.consultations.waitingEvents(consultationRequestId)}`,
  );
}
