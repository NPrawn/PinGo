import { http, HttpResponse } from 'msw';

/**
 * 시설 목록. 지도 위 시설 마커(FR-U-006)를 확인하는 데 쓴다.
 *
 * 좌표는 실제 응답에서 가져온 값이고, 이름은 화면 테스트가 기대하는 목업 경유지 이름에
 * 맞췄다. 오리진을 와일드카드로 두는 이유는 `apiClient`의 base URL이 환경변수라서다.
 */
const FACILITIES = [
  {
    facilityId: 50,
    stationId: 1,
    floorId: 1,
    facilityType: 'card_charger',
    nameKo: '승차권 충전',
    nameEn: 'Transit Card Reload Machine',
    mapX: -12.433,
    mapY: 23.863,
    linkedNodeId: 121,
    isAccessible: true,
  },
  {
    facilityId: 52,
    stationId: 1,
    floorId: 1,
    facilityType: 'elevator',
    nameKo: '엘리베이터',
    nameEn: 'Elevator',
    mapX: -0.4,
    mapY: 27.2,
    linkedNodeId: 123,
    isAccessible: true,
  },
  /** 출구는 B1(floorId 3)에 있다. B2를 보고 있을 때 목적지 마커가 없는 것이 정상이다. */
  {
    facilityId: 25,
    stationId: 1,
    floorId: 3,
    facilityType: 'exit',
    nameKo: '7번 출구',
    nameEn: 'Exit 7',
    mapX: 149.166,
    mapY: -33.989,
    linkedNodeId: 44,
    isAccessible: false,
  },
  {
    facilityId: 41,
    stationId: 1,
    floorId: 3,
    facilityType: 'exit',
    nameKo: '2번 출구',
    nameEn: 'Exit 2',
    mapX: 99.725,
    mapY: 48.451,
    linkedNodeId: 60,
    isAccessible: false,
  },
];

/**
 * 층별 지도. 역삼역 배포 값을 그대로 옮겼다.
 *
 * **`floorId` 순서가 층 순서와 다르다**(B1=3·B2=1·B3=2). auto-increment라 그렇고, 코드↔id를
 * 상수로 매핑하면 안 되는 이유이기도 하다. 도면은 아직 업로드되지 않아 `mapUrl`이 null이다.
 */
const FLOOR_MAPS = [
  floorMap(1, 3, 'B1', 1626, 967, 594, 501),
  floorMap(2, 1, 'B2', 1624, 969, 622, 512),
  floorMap(3, 2, 'B3', 1659, 948, 597, 497),
];

function floorMap(
  mapId: number,
  floorId: number,
  floorCode: string,
  width: number,
  height: number,
  originPxX: number,
  originPxY: number,
) {
  return {
    mapId,
    floorId,
    floorCode,
    mapType: 'image',
    mapUrl: null,
    width,
    height,
    scaleMPerPx: 0.19,
    originPxX,
    originPxY,
    frameAngleDeg: -21.28,
    version: 'v1',
  };
}

export const handlers = [
  http.get('/health', () => HttpResponse.json({ status: 'ok' })),
  http.get('*/api/stations/:stationId/maps', () =>
    HttpResponse.json({ success: true, data: FLOOR_MAPS, message: null }),
  ),
  http.get('*/api/stations/:stationId/facilities', ({ request }) => {
    const type = new URL(request.url).searchParams.get('facilityType');
    const data = type ? FACILITIES.filter((f) => f.facilityType === type) : FACILITIES;

    return HttpResponse.json({ success: true, data, message: null });
  }),
];
