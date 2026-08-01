/**
 * 역 내부 시설 한 곳. (API 명세서 5.2 시설 목록 조회)
 *
 * 출구도 시설의 한 유형이다(`facilityType: 'exit'`). 별도 리소스가 아니다.
 */
export interface Facility {
  facilityId: number;
  stationId: number;
  floorId: number;
  /**
   * 시설 유형 코드. 알려진 값은 `KNOWN_FACILITY_TYPES`에 있다.
   *
   * **문자열로 둔다.** 유니온으로 좁히면 백엔드가 유형을 추가할 때(실제로 311에서 약국·편의점
   * 등이 추가됐다) 타입이 먼저 깨진다. 표시 쪽은 모르는 유형에 기본 아이콘을 쓴다.
   */
  facilityType: string;
  nameKo: string;
  nameEn: string | null;
  /**
   * 캐노니컬 미터 좌표. **픽셀이 아니다.** 음수가 정상이며 층간 엘리베이터가 원점이다.
   * 지도에 그릴 때는 층별 지도 응답의 좌표 프레임으로 변환한다(API 명세서 5.1).
   */
  mapX: number;
  mapY: number;
  /** 연결된 경로 노드. 경로 탐색의 출발·도착 지정에 쓴다. 없을 수 있다. */
  linkedNodeId: number | null;
  /** 계단 없이 도달 가능한지. 출구는 엘리베이터 도달 여부를 뜻한다(API 명세서 5.2). */
  isAccessible: boolean;
}
