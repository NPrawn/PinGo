import type { RouteType, RouteUnavailableReason } from '@/shared/types';

/**
 * 경로 옵션 하나. (`POST /api/routes/indoor/options` 응답 항목)
 *
 * 백엔드 `RouteOptionResponse` 레코드와 필드가 1:1로 대응한다. 상세 경로(`steps`·`pathNodes`)는
 * 여기에 없고 경로 생성(8.2)에서 온다.
 */
export interface RouteOption {
  routeType: RouteType;
  /** 화면에 그대로 쓰는 이름. 백엔드가 정한다(`빠른 경로`·`엘리베이터 이용 경로`). */
  displayName: string;
  /**
   * 이 유형으로 목적지에 도달할 수 있는지.
   *
   * 쓸 수 없는 옵션도 목록에서 빼지 않는다. 역삼역은 B1↔B2에 엘리베이터가 없어
   * `elevator_only`로 B1 출구에 갈 수 없는데, 목록에서 지워 버리면 사용자는 그런 경로가
   * 있는지조차 모른 채 계단으로 안내받는다.
   */
  available: boolean;
  /** `available`이 false일 때만 채워진다. */
  unavailableReason: RouteUnavailableReason | null;
  /** 총 거리(m). 도달할 수 없으면 null이다. */
  totalDistanceM: number | null;
  /**
   * 예상 시간(초). 도달할 수 없거나, **경로상 간선 하나라도 예상 시간이 없으면** null이다.
   * 거리는 있는데 시간만 없는 경우가 실제로 생긴다.
   */
  estimatedTimeSec: number | null;
  /**
   * 이 경로가 계단이나 에스컬레이터를 지나는지. (FR-U-009 "계단 포함 여부")
   *
   * 옵션 조회에는 `steps`가 없어 클라이언트가 스스로 판단할 수 없으므로 백엔드가 함께 준다.
   * `elevator_only`는 정의상 항상 false다. 휠체어·유모차에게는 에스컬레이터도 계단과 같은
   * 장벽이라 둘을 하나로 묶는다.
   */
  hasStairsOrEscalator: boolean;
}

/** 경로 옵션 조회 요청. (백엔드 `RouteOptionsRequest`) */
export interface RouteOptionsQuery {
  stationId: number;
  startNodeId: number;
  /** 도착 실내 노드. 외부 목적지 검색·출구 추천은 이 API 범위 밖이다. */
  targetNodeId: number;
  language?: 'ko' | 'en';
  /**
   * 사용자의 실제 캐노니컬 좌표. 선택이며 **짝으로 있어야** 쓰인다. (`routeOriginOf`)
   *
   * 서버가 이 값으로 진입 노드를 목적지까지의 총 거리가 가장 짧은 것으로 다시 고른다.
   * **경로 생성에도 같은 값을 보내야 한다** — 한쪽만 보내면 진입 노드가 달라져, 이 화면에서
   * 본 거리와 안내 화면의 경로 길이가 어긋난다.
   */
  currentMapX?: number;
  currentMapY?: number;
}
