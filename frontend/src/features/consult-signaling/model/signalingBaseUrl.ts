import { env } from '@/shared/config';

/** 소켓 주소를 정하는 데 필요한 것만 받는다. 테스트가 실기기 상황을 그대로 만들 수 있어야 한다. */
type PageLocation = { protocol: string; host: string };

/**
 * signaling 소켓이 붙을 곳. **API 와 같은 길로 보낸다.** (S15P11A206-89)
 *
 * `VITE_API_BASE_URL` 이 비어 있으면 앱은 API 를 상대 경로로 부르고, 그 요청은 개발 서버가
 * 대신 보낸다(vite.config.ts). 그런데 소켓만 `VITE_WS_BASE_URL` 절대 주소로 폰에서 직접
 * 나가고 있었다.
 *
 * 백엔드의 `signaling.websocket.allowed-origin-patterns` 에는 `localhost:5173` 계열과 배포
 * 주소만 있다. 그래서 LAN 주소로 접속한 폰은 handshake 단계에서 거절당하고, upgrade 가 끝나지
 * 않은 채 **close code 1006** 으로 끊겼다 — 서버가 close frame 을 보낼 기회조차 없어 원인을
 * 알려 주는 코드도 남지 않는다. 데스크톱은 허용 목록에 있는 `localhost` 라 같은 코드가 그대로
 * 붙었고, 그래서 실기기에서만 재현됐다.
 *
 * 같은 오리진으로 보내면 개발 서버가 `Origin` 을 배포 주소로 바꿔 전달하므로 허용 목록을
 * 건드리지 않아도 된다. LAN IP 를 목록에 넣는 방법은 IP 가 바뀔 때마다 백엔드를 다시 배포해야
 * 해서 유지되지 않는다 — `/api` 프록시가 같은 이유로 이미 이 방식을 쓴다.
 *
 * 배포 환경은 프론트와 백엔드가 같은 오리진이라 이 갈래가 내는 값이 `VITE_WS_BASE_URL` 기본값과
 * 같다. 절대 주소를 지정한 경우에는 그것을 그대로 쓴다.
 */
export function signalingBaseUrl(location: PageLocation = window.location): string {
  if (env.VITE_API_BASE_URL) return env.VITE_WS_BASE_URL.replace(/\/$/, '');

  const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${location.host}`;
}
