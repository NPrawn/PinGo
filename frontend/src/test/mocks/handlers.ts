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
];

export const handlers = [
  http.get('/health', () => HttpResponse.json({ status: 'ok' })),
  http.get('*/api/stations/:stationId/facilities', ({ request }) => {
    const type = new URL(request.url).searchParams.get('facilityType');
    const data = type ? FACILITIES.filter((f) => f.facilityType === type) : FACILITIES;

    return HttpResponse.json({ success: true, data, message: null });
  }),
];
