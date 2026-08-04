/**
 * WebRTC DataChannel 로 오가는 상담 이벤트.
 *
 * `docs/WebRTC_DataChannel_이벤트_명세서.md` 4·6·7장의 계약을 그대로 옮긴 것이다.
 *
 * **그리기 좌표는 두 계가 있다.** 명세 6장은 공유 화면 기준 정규화 값(0~1) 하나만 두었는데,
 * 그것은 상담자가 사용자의 **카메라 영상** 위에 그린다는 전제였다. 지도 위에 그리는 선은 두
 * 사람의 확대·이동·회전·표시 층이 달라 그 기준이 통하지 않으므로 캐노니컬 미터를 쓴다.
 * 자세한 근거는 `MapDrawPoint` 에 적어 두었다. (S15P11A206-89)
 */

export type ConsultEventSender = 'USER' | 'COUNSELOR' | 'SYSTEM';

/** 공유 화면 기준 정규화 좌표(0~1). 카메라 영상 위에 그리는 선이 쓴다(명세 6장). */
export interface DrawPoint {
  x: number;
  y: number;
}

/**
 * 지도 위 한 점. **캐노니컬 미터**다. (S15P11A206-89)
 *
 * 지도에는 정규화 좌표를 쓸 수 없다. 두 사람이 보는 범위가 다르고(사용자는 60m로 당겨 자기
 * 위치를 따라가고 상담자는 전체를 본다), 사용자 지도는 진행 방향으로 **회전**하며, 층도 서로
 * 다를 수 있다. 같은 0.5·0.5가 전혀 다른 곳을 가리킨다.
 *
 * 미터로 보내면 받는 쪽이 자기 화면의 변환으로 투영하므로 확대·이동·회전과 무관하게 같은 자리에
 * 그려진다. 지도의 다른 것(현재 위치·목적지·경로)이 이미 이 좌표를 쓴다.
 */
export interface MapDrawPoint {
  mapX: number;
  mapY: number;
}

/**
 * 선 하나의 시작.
 *
 * **두 좌표계를 유니온으로 갈라 둔다.** 한 payload에 둘을 섞으면 받는 쪽이 어느 쪽을 읽어야
 * 하는지 런타임에 판단해야 하고, 잘못 읽어도 오류가 나지 않고 선만 엉뚱한 자리에 뜬다. 유니온이면
 * 컴파일러가 반대쪽 필드 접근을 막는다.
 */
export type DrawStrokeStartPayload =
  | ({ strokeId: string; color: string; width: number } & DrawPoint)
  | {
      strokeId: string;
      color: string;
      width: number;
      /** 이 선이 놓인 층. 다른 층을 보고 있으면 그리지 않는다. */
      floorId: number;
      map: MapDrawPoint;
    };

export type DrawStrokeMovePayload =
  { strokeId: string; points: DrawPoint[] } | { strokeId: string; mapPoints: MapDrawPoint[] };

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
