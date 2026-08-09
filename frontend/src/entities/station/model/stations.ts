/**
 * 역 선택 화면의 기본값.
 *
 * 역 목록·검색은 모두 역 API에서 가져온다. 여기 남은 값은 사용자가 아직 출발지를 고르지
 * 않았을 때 쓰는 초기값뿐이다.
 */
export const DEFAULT_STATION = '역삼역';

/**
 * 역삼역의 백엔드 역 id. 출발지를 고르기 전의 `stationStore.stationId` 초기값이다.
 *
 * 지금 실내 데이터가 등록된 역은 이곳뿐이라 초기값으로 쓸 수 있다. 화면이 `1`을 직접 적어
 * 쓰지 않도록 이름을 붙여 둔다.
 */
export const DEFAULT_STATION_ID = 1;
