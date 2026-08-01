import '@testing-library/jest-dom/vitest';
import '@/shared/i18n';
import { server } from './mocks/server';

/**
 * API 목 서버. 지금까지 핸들러만 두고 켜지 않아 실제 요청이 jsdom에서 그대로 나갔다.
 *
 * 처리되지 않은 요청은 막지 않고 통과시킨다(`bypass`). 켜는 시점에 이미 여러 화면 테스트가
 * 훅을 직접 목으로 대체하고 있어서, 엄격하게 막으면 그쪽이 함께 깨진다. 요청을 가로채고 싶은
 * 테스트만 `handlers`에 추가하면 된다.
 */
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

// 테스트가 임시로 덮어쓴 핸들러를 되돌린다.
afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
