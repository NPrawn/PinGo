/**
 * 실내 경로 옵션 유형. (백엔드 `RouteType`, API 명세서 8.1)
 *
 * - `fastest` — 모든 활성 간선을 허용한다. 가중치는 거리다.
 * - `elevator_only` — 계단·에스컬레이터를 **제외**한다. 엘리베이터 간선만 쓰는 경로가 아니라
 *   계단·에스컬레이터 없이 도달 가능한 경로를 뜻한다.
 *
 * 화면이 자기 어휘(예전의 `fast`·`elev`)를 따로 두지 않고 이 값을 그대로 쓴다. 프론트가 별도
 * 이름을 들고 있으면 백엔드가 유형을 늘려도 화면이 따라가지 못한다.
 *
 * 경로 조회(`entities/route`)와 선택 상태(`entities/navigation`)가 함께 쓰므로 여기에 둔다.
 * `FloorId`와 같은 자리다.
 */
export type RouteType = 'fastest' | 'elevator_only';

/**
 * 경로를 쓸 수 없는 사유. (백엔드 `RouteUnavailableReason`)
 *
 * HTTP 오류가 아니라 정상 응답(200) 안에 담긴다. 도달할 수 없다는 것도 사용자에게 알려야 할
 * 결과이기 때문이다.
 *
 * - `NO_ROUTE` — 출발지에서 도착지까지 연결된 경로가 없다.
 * - `NO_ACCESSIBLE_ROUTE` — 계단·에스컬레이터를 뺀 조건으로는 도달할 수 없다.
 */
export type RouteUnavailableReason = 'NO_ROUTE' | 'NO_ACCESSIBLE_ROUTE';
