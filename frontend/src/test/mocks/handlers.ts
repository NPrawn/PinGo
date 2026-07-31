import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('http://localhost:8080/api/health', () => HttpResponse.text('OK')),
  http.post('http://localhost:8080/api/user-sessions', () =>
    HttpResponse.json({
      success: true,
      data: {
        userSessionId: 'test-user-session',
        language: 'ko',
        expiresAt: '2099-01-01T00:00:00Z',
      },
    }),
  ),
  http.get('http://localhost:8080/api/user-sessions/:userSessionId', ({ params }) =>
    HttpResponse.json({
      success: true,
      data: {
        userSessionId: params.userSessionId,
        language: 'ko',
        expiresAt: '2099-01-01T00:00:00Z',
      },
    }),
  ),
  http.get('http://localhost:8080/api/counselors/me', () =>
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
  http.get('http://localhost:8080/api/counselors/consultations', () =>
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
  http.post('http://localhost:8080/api/consultations/:consultationId/accept', ({ params }) =>
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
  http.post('http://localhost:8080/api/consultations/:consultationId/end', ({ params }) =>
    HttpResponse.json({
      success: true,
      data: { consultationId: params.consultationId, status: 'ENDED' },
    }),
  ),
  http.get('http://localhost:8080/api/admin/stations', () =>
    HttpResponse.json({ success: true, data: [] }),
  ),
  // 최단 경로 카드가 쓰는 "목적지에서 가장 가까운 출구".
  http.post('http://localhost:8080/api/destinations/nearest-exit', () =>
    HttpResponse.json({
      success: true,
      data: { exitFacilityId: 82, exitNumber: '3' },
    }),
  ),
  http.get('http://localhost:8080/api/stations/nearby', () =>
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
  http.get('http://localhost:8080/api/stations/search', ({ request }) => {
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
  http.post('http://localhost:8080/api/auth/login', async ({ request }) => {
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
