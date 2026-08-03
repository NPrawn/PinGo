/**
 * WebRTC DataChannel 로 오가는 상담 이벤트.
 *
 * `docs/WebRTC_DataChannel_이벤트_명세서.md` 4·6·7장의 계약을 그대로 옮긴 것이다.
 * 좌표는 공유 화면 기준 정규화 값(0~1)이라 두 기기의 해상도·비율이 달라도 같은 자리에
 * 그려진다.
 */

export type ConsultEventSender = 'USER' | 'COUNSELOR' | 'SYSTEM';

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawStrokeStartPayload extends DrawPoint {
  strokeId: string;
  color: string;
  width: number;
}

export interface DrawStrokeMovePayload {
  strokeId: string;
  points: DrawPoint[];
}

export interface DrawStrokeEndPayload {
  strokeId: string;
}

/** 지도 위 한 점. 백엔드 좌표(`mapX`·`mapY`)를 그대로 나른다. */
export interface MapPointPayload {
  floorId: number;
  mapX: number;
  mapY: number;
}

/**
 * 사용자가 지금 보고 있는 지도 상태.
 *
 * 상담자 화면이 같은 도면·같은 층·같은 경로를 그리게 하려고 통째로 보낸다. 조각으로 나눠
 * 보내면 하나만 늦게 도착해도 두 화면이 서로 다른 곳을 가리키는데, 그 상태로 안내를 하면
 * 사용자는 상담자가 짚어 준 곳을 찾지 못한다. 늦게 온 스냅숏은 앞의 것을 덮어쓰면 그만이다.
 */
export interface MapSyncPayload {
  stationId: number;
  /** 사용자가 화면에 띄우고 있는 층. */
  floorId: number | null;
  /** 사용자의 현재 위치. 위치를 모르는 층에서는 null 이다. */
  current: MapPointPayload | null;
  /** 사용자가 바라보는 방향(도). 모르면 null. */
  headingDeg: number | null;
  destination: MapPointPayload | null;
  destinationLabel: string | null;
  /** 경로가 지나는 노드. 상담자 화면도 같은 선을 그린다. */
  pathNodes: (MapPointPayload & { nodeId: number })[];
}

/**
 * 상담자가 짚어 준 지점.
 *
 * 상담자는 사용자와 같은 도면을 보고 있으므로 좌표를 그대로 넘길 수 있다. 이름만 보내면
 * 사용자 화면이 그 이름으로 시설을 다시 찾아야 하는데, 표기가 조금만 달라도 엉뚱한 곳을
 * 가리키거나 아무것도 찾지 못한다.
 */
export interface MapPickPayload extends MapPointPayload {
  facilityId: number;
  nameKo: string;
  /** 경로 계산에 쓰는 노드. 시설에 연결된 노드가 없으면 null 이다. */
  linkedNodeId: number | null;
}

export type ConsultEventBody =
  | { eventType: 'DRAW_STROKE_START'; payload: DrawStrokeStartPayload }
  | { eventType: 'DRAW_STROKE_MOVE'; payload: DrawStrokeMovePayload }
  | { eventType: 'DRAW_STROKE_END'; payload: DrawStrokeEndPayload }
  | { eventType: 'DRAW_CLEAR'; payload: Record<string, never> }
  | { eventType: 'MAP_SYNC'; payload: MapSyncPayload }
  /** 상담자가 새 목적지를 짚었다. 사용자 화면이 목적지를 그리로 옮긴다. */
  | { eventType: 'DESTINATION_CHANGE_REQUESTED'; payload: MapPickPayload }
  /** 상담자가 사용자의 실제 위치를 짚었다. 위치 인식이 빗나갔을 때 바로잡는 길이다. */
  | { eventType: 'CURRENT_LOCATION_CORRECTED'; payload: MapPickPayload };

export type ConsultEventType = ConsultEventBody['eventType'];

/** 명세 4장의 공통 envelope. */
export type ConsultDataEvent = ConsultEventBody & {
  sessionId: string;
  eventId: string;
  senderType: ConsultEventSender;
  timestamp: string;
  version: number;
};

const EVENT_VERSION = 1;

let eventSequence = 0;

/** 수신 측이 중복을 걸러 낼 수 있게 이벤트마다 고유한 값을 붙인다(명세 4장). */
function nextEventId() {
  eventSequence += 1;
  return `evt_${Date.now().toString(36)}_${eventSequence.toString(36)}`;
}

export function createConsultEvent(
  sessionId: string,
  senderType: ConsultEventSender,
  body: ConsultEventBody,
): ConsultDataEvent {
  return {
    ...body,
    sessionId,
    eventId: nextEventId(),
    senderType,
    timestamp: new Date().toISOString(),
    version: EVENT_VERSION,
  };
}

const CONSULT_EVENT_TYPES = new Set<string>([
  'DRAW_STROKE_START',
  'DRAW_STROKE_MOVE',
  'DRAW_STROKE_END',
  'DRAW_CLEAR',
  'MAP_SYNC',
  'DESTINATION_CHANGE_REQUESTED',
  'CURRENT_LOCATION_CORRECTED',
]);

/** 상대가 보낸 것을 그대로 믿지 않는다. 모양이 맞는 이벤트만 화면에 반영한다. */
export function parseConsultEvent(raw: string): ConsultDataEvent | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ConsultDataEvent>;
    if (typeof parsed?.eventId !== 'string') return null;
    if (typeof parsed.eventType !== 'string' || !CONSULT_EVENT_TYPES.has(parsed.eventType))
      return null;
    return parsed as ConsultDataEvent;
  } catch {
    return null;
  }
}
