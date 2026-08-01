export type Station = {
  name: string;
  /**
   * 백엔드 역 id. 지도·시설·경로 API 요청에 쓴다.
   *
   * 등록된 역이 아니면 null이다. 역 조회 API(FR-U-003)가 붙기 전까지 id를 아는 역은
   * 역삼역뿐이며, 나머지는 이름만 있는 프로토타입 항목이다. 임의의 숫자를 채우면 그 역을
   * 골랐을 때 남의 역 데이터를 부르게 된다.
   */
  stationId: number | null;
  line: string;
  /** Human-readable distance, or a GPS note for the detected station. */
  dist: string;
  /** True for the station detected from GPS. */
  here?: boolean;
};
