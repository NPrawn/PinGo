import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/health', () => HttpResponse.json({ status: 'ok' })),
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
