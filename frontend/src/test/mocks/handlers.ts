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
  /**
   * 출구는 B1(floorId 3)에 있다. B2를 보고 있을 때 목적지 마커가 없는 것이 정상이다.
   *
   * `linkedNodeId`는 V8 시드 재구축 뒤의 실제 값이다. 7번 출구가 325인 것은 경로 옵션 화면의
   * 임시 도착 노드와 같은 값이어야 한다 — 목업이 다른 노드를 가리키면 이 흐름을 목업으로
   * 따라가는 사람이 잘못된 결론을 얻는다.
   */
  {
    facilityId: 25,
    stationId: 1,
    floorId: 3,
    facilityType: 'exit',
    nameKo: '7번 출구',
    nameEn: 'Exit 7',
    mapX: 149.166,
    mapY: -33.989,
    linkedNodeId: 325,
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
    linkedNodeId: 341,
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

/**
 * 경로 옵션. B3 승강장(205)에서 7번 출구(325)로 가는 실제 조합을 담았다.
 *
 * 역삼역은 B1↔B2에 엘리베이터가 없어 `elevator_only`가 B1 출구에 도달하지 못한다. 백엔드가
 * 돌려주는 것이 바로 이 모양이므로, 도달 불가 표시를 여기서 그대로 확인할 수 있다.
 */
const ROUTE_OPTIONS = [
  {
    routeType: 'fastest',
    displayName: '빠른 경로',
    available: true,
    unavailableReason: null,
    totalDistanceM: 180,
    estimatedTimeSec: 240,
    hasStairsOrEscalator: true,
  },
  {
    routeType: 'elevator_only',
    displayName: '엘리베이터 이용 경로',
    available: false,
    unavailableReason: 'NO_ACCESSIBLE_ROUTE',
    totalDistanceM: null,
    estimatedTimeSec: null,
    hasStairsOrEscalator: false,
  },
];

export const handlers = [
  http.get('*/api/health', () => HttpResponse.text('OK')),
  http.post('*/api/user-sessions', () =>
    HttpResponse.json({
      success: true,
      data: {
        userSessionId: 'test-user-session',
        language: 'ko',
        expiresAt: '2099-01-01T00:00:00Z',
      },
    }),
  ),
  http.get('*/api/user-sessions/:userSessionId', ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        userSessionId: params.userSessionId,
        language: 'ko',
        expiresAt: '2099-01-01T00:00:00Z',
      },
    }),
  ),
  http.get('*/api/counselors/me', () =>
    HttpResponse.json({
      success: true,
      data: {
        accountId: 1,
        loginId: 'counselor',
        name: '테스트 상담원',
        stationId: 1,
        isActive: true,
        status: 'AVAILABLE',
      },
    }),
  ),
  http.get('*/api/counselors/consultations', () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          consultationId: 'cs_test',
          stationId: 1,
          problemType: 'CANNOT_FIND_EXIT',
          status: 'WAITING',
          currentNodeId: 101,
          currentLocationLabel: 'B2 개찰구 앞',
          destinationType: 'place',
          destinationId: 3,
          destinationLabel: '코엑스몰',
          requestedAt: '2026-07-31T00:00:00Z',
        },
      ],
    }),
  ),
  http.post('*/api/consultations/:consultationId/accept', ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        consultationId: params.consultationId,
        status: 'ACCEPTED',
        counselorId: 1,
        signalingRoomId: `room_${params.consultationId}`,
      },
    }),
  ),
  http.post('*/api/consultations/:consultationId/end', ({ params }) =>
    HttpResponse.json({
      success: true,
      data: { consultationId: params.consultationId, status: 'ENDED' },
    }),
  ),
  http.get('*/api/admin/stations', () => HttpResponse.json({ success: true, data: [] })),
  // 최단 경로 카드가 쓰는 "목적지에서 가장 가까운 출구".
  http.post('*/api/destinations/nearest-exit', () =>
    HttpResponse.json({
      success: true,
      data: { exitFacilityId: 82, exitNumber: '3' },
    }),
  ),
  http.post('*/api/routes/indoor/options', () =>
    HttpResponse.json({ success: true, data: ROUTE_OPTIONS, message: null }),
  ),
  http.get('*/api/stations/:stationId/maps', () =>
    HttpResponse.json({ success: true, data: FLOOR_MAPS, message: null }),
  ),
  http.get('*/api/stations/:stationId/facilities', ({ request }) => {
    const type = new URL(request.url).searchParams.get('facilityType');
    const data = type ? FACILITIES.filter((f) => f.facilityType === type) : FACILITIES;

    return HttpResponse.json({ success: true, data, message: null });
  }),
  http.get('*/api/stations/nearby', () =>
    HttpResponse.json({
      success: true,
      data: [
        {
          stationId: 1,
          nameKo: '역삼역',
          nameEn: 'Yeoksam Station',
          lineInfo: '2호선',
          distanceM: 89,
        },
      ],
    }),
  ),
  // 등록된 역과 외부(카카오) 지하철역 결과를 함께 내려주는 실제 응답을 흉내낸다.
  http.get('*/api/stations/search', ({ request }) => {
    const keyword = new URL(request.url).searchParams.get('keyword')?.trim() ?? '';
    const registered = {
      stationId: 1,
      nameKo: '역삼역',
      nameEn: 'Yeoksam Station',
      lineInfo: '2호선',
      provider: 'pingo',
      externalId: null,
      address: null,
      latitude: 37.5007,
      longitude: 127.0365,
      serviceReady: true,
    };

    if (!keyword) {
      return HttpResponse.json({ success: true, data: [registered] });
    }

    const data = [];
    if (registered.nameKo.includes(keyword)) {
      data.push(registered);
    }
    if ('선릉역'.includes(keyword)) {
      data.push({
        stationId: null,
        nameKo: '선릉역',
        nameEn: null,
        lineInfo: '2호선·수인분당선',
        provider: 'kakao',
        externalId: '21160338',
        address: '서울 강남구 테헤란로 340',
        latitude: 37.50452,
        longitude: 127.048913,
        serviceReady: false,
      });
    }

    return HttpResponse.json({ success: true, data });
  }),
  http.post('*/api/auth/login', async ({ request }) => {
    const credentials = (await request.json()) as {
      loginId?: string;
      password?: string;
    };

    if (credentials.loginId === 'admin' && credentials.password === '1234') {
      return HttpResponse.json({
        success: true,
        data: {
          accessToken: 'admin-access-token',
          accountType: 'ADMIN',
          accountId: 1,
          name: '테스트 관리자',
          stationId: null,
          status: null,
        },
      });
    }

    return HttpResponse.json(
      {
        success: false,
        code: 'INVALID_CREDENTIALS',
        message: '아이디와 비밀번호를 확인해 주세요.',
      },
      { status: 401 },
    );
  }),
];
