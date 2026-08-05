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
    exitDetail: {
      exitNumber: '7',
      outsideLatitude: 37.5002,
      outsideLongitude: 127.0359,
    },
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
  /**
   * 엘리베이터로 닿는 유일한 출구. 역삼역에서 `is_accessible = 1`인 둘 중 하나다(V10).
   *
   * B2에 있어 B1↔B2 엘리베이터가 없는 것과 무관하게 도달할 수 있다. 엘리베이터 우선 경로가
   * 실제로 갈 수 있는 출구가 하나는 있어야 그 흐름을 목업으로 따라갈 수 있다.
   */
  {
    facilityId: 82,
    stationId: 1,
    floorId: 1,
    facilityType: 'exit',
    nameKo: '3번 출구',
    nameEn: 'Exit 3',
    mapX: -58.4,
    mapY: 42.5,
    linkedNodeId: 153,
    isAccessible: true,
    exitDetail: {
      exitNumber: '3',
      outsideLatitude: 37.4998,
      outsideLongitude: 127.0348,
    },
  },
];

/** 계단 없이 나갈 수 있는 출구의 도착 노드. 이 노드로 가는 경로만 엘리베이터로 완주된다. */
const ACCESSIBLE_TARGET_NODE_ID = 153;

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

/**
 * 계단 없이 닿는 출구로 가는 경로. 두 유형 모두 완주된다.
 *
 * 도착 노드가 달라지면 결과도 달라진다는 것이 이 흐름의 핵심이라 목업도 노드로 갈라 준다.
 * 하나의 응답만 두면 "엘리베이터 우선은 늘 도달 불가"라는 잘못된 인상을 준다.
 */
const ACCESSIBLE_ROUTE_OPTIONS = [
  {
    routeType: 'fastest',
    displayName: '빠른 경로',
    available: true,
    unavailableReason: null,
    totalDistanceM: 117,
    estimatedTimeSec: 123,
    hasStairsOrEscalator: false,
  },
  {
    routeType: 'elevator_only',
    displayName: '엘리베이터 이용 경로',
    available: true,
    unavailableReason: null,
    totalDistanceM: 117,
    estimatedTimeSec: 123,
    hasStairsOrEscalator: false,
  },
];

/**
 * 상세 경로. 안내 화면이 카드 문구와 지도 경로선을 이것으로 그린다.
 *
 * 노드와 좌표는 V8 시드의 실제 값이다 — B3 승강장(205)에서 B2 대합실을 지나 출구로 향한다.
 * 첫 구간의 `instruction`이 안내 카드의 제목이 된다.
 */
const ROUTE_DETAIL = {
  routeType: 'fastest',
  displayName: '빠른 경로',
  available: true,
  unavailableReason: null,
  startNodeId: 205,
  targetNodeId: 325,
  totalDistanceM: 224,
  estimatedTimeSec: 252,
  steps: [
    {
      order: 1,
      fromNodeId: 205,
      toNodeId: 202,
      distanceM: 25,
      estimatedTimeSec: 28,
      moveType: 'walk',
      instruction: '개찰구 방향으로 25m 직진하세요',
      /*
        거리 자리를 비운 같은 문장. **실제 서버가 함께 내려보내는 값이다**(S15P11A206-339).
        목업에 없어서 화면이 걷는 동안 거리를 갱신하는지를 테스트가 볼 수 없었다 — 템플릿이 없으면
        `instructionAt`이 완성 문장을 그대로 돌려주므로, 남은 거리를 쓰든 구간 전체를 쓰든 결과가
        같아진다. 카드와 상세 경로가 서로 다른 숫자를 말하던 것도 그래서 드러나지 않았다.
      */
      instructionTemplate: '개찰구 방향으로 {distance} 직진하세요',
    },
    {
      order: 2,
      fromNodeId: 202,
      toNodeId: 102,
      distanceM: 6,
      estimatedTimeSec: 40,
      moveType: 'elevator',
      instruction: '엘리베이터를 타고 B2로 이동하세요',
      // 층 이동 문장에는 거리가 들어가지 않는다. 채울 자리가 없다.
      instructionTemplate: '엘리베이터를 타고 B2로 이동하세요',
    },
  ],
  pathNodes: [
    { nodeId: 205, floorId: 2, mapX: -25.3, mapY: 25.6 },
    { nodeId: 202, floorId: 2, mapX: -0.4, mapY: 27.2 },
    { nodeId: 102, floorId: 1, mapX: -0.4, mapY: 27.2 },
  ],
};

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
  /**
   * 목적지에서 가장 가까운 출구. 경로 유형마다 다른 출구가 나온다.
   *
   * `accessibleOnly`를 켜면 엘리베이터로 닿는 출구만 후보가 된다. 실제 서버도 같은 방식이며,
   * 그래서 최단 경로와 엘리베이터 우선 경로의 도착 출구가 갈린다.
   */
  http.post('*/api/destinations/nearest-exit', async ({ request }) => {
    const body = (await request.json()) as { accessibleOnly?: boolean };

    return HttpResponse.json({
      success: true,
      data: body.accessibleOnly
        ? { exitFacilityId: 82, exitNumber: '3' }
        : { exitFacilityId: 25, exitNumber: '7' },
    });
  }),
  http.get('*/api/facilities/:facilityId', ({ params }) => {
    const facility = FACILITIES.find((item) => item.facilityId === Number(params.facilityId));
    if (!facility) {
      return HttpResponse.json(
        { success: false, code: 'FACILITY_NOT_FOUND', message: '시설을 찾을 수 없습니다.' },
        { status: 404 },
      );
    }

    return HttpResponse.json({ success: true, data: facility, message: null });
  }),
  http.post('*/api/routes/indoor', () =>
    HttpResponse.json({ success: true, data: ROUTE_DETAIL, message: null }),
  ),
  http.post('*/api/routes/indoor/options', async ({ request }) => {
    const body = (await request.json()) as { targetNodeId?: number };
    const data =
      body.targetNodeId === ACCESSIBLE_TARGET_NODE_ID ? ACCESSIBLE_ROUTE_OPTIONS : ROUTE_OPTIONS;

    return HttpResponse.json({ success: true, data, message: null });
  }),
  http.post('*/api/external-maps/directions', async ({ request }) => {
    const body = (await request.json()) as { origin?: { longitude?: number } };
    const elevatorRoute = body.origin?.longitude === 127.0348;

    return HttpResponse.json({
      success: true,
      data: {
        provider: 'kakao',
        appUrl: 'kakaomap://route?by=foot',
        webUrl: 'https://map.kakao.com/example',
        distanceM: elevatorRoute ? 2638 : 2450,
        estimatedTimeSec: elevatorRoute ? 2525 : 2295,
      },
      message: null,
    });
  }),
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
