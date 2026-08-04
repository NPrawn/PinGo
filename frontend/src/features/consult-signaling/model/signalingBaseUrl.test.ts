import { signalingBaseUrl } from './signalingBaseUrl';

const { envMock } = vi.hoisted(() => ({
  envMock: { VITE_API_BASE_URL: '', VITE_WS_BASE_URL: 'wss://jenkins.example.invalid' },
}));

vi.mock('@/shared/config', () => ({ env: envMock }));

describe('signalingBaseUrl', () => {
  beforeEach(() => {
    envMock.VITE_API_BASE_URL = '';
    envMock.VITE_WS_BASE_URL = 'wss://jenkins.example.invalid';
  });

  /**
   * 실기기 확인에서 막혔던 자리다. (S15P11A206-89)
   *
   * 폰이 LAN 주소로 접속하면 그 오리진은 백엔드의 `allowed-origin-patterns` 에 없어 handshake
   * 가 거절되고, upgrade 가 끝나지 않은 채 close code 1006 으로 끊긴다. 같은 오리진으로 보내야
   * 개발 서버 프록시가 `Origin` 을 배포 주소로 바꿔 전달한다.
   */
  it('API 를 상대 경로로 부르는 동안에는 소켓도 같은 오리진으로 보낸다', () => {
    const base = signalingBaseUrl({ protocol: 'https:', host: '192.168.0.5:5173' });

    expect(base).toBe('wss://192.168.0.5:5173');
  });

  /** 배포 빌드도 `VITE_API_BASE_URL` 이 빈 값이다(Jenkinsfile). 같은 오리진이 곧 배포 주소다. */
  it('배포 주소에서 열면 지금까지 쓰던 주소와 같은 값이 된다', () => {
    const base = signalingBaseUrl({ protocol: 'https:', host: 'jenkins.example.invalid' });

    expect(base).toBe('wss://jenkins.example.invalid');
  });

  /** 보안 문맥이 아닌 곳에서 `wss:` 로 보내면 붙지 않는다. 페이지 방식을 따라간다. */
  it('http 로 열린 페이지에서는 ws 로 보낸다', () => {
    const base = signalingBaseUrl({ protocol: 'http:', host: 'localhost:5173' });

    expect(base).toBe('ws://localhost:5173');
  });

  /** 절대 주소를 지정한 빌드는 그것을 그대로 쓴다. 프록시가 없는 환경도 있다. */
  it('백엔드 절대 주소를 지정했으면 지정한 소켓 주소를 쓴다', () => {
    envMock.VITE_API_BASE_URL = 'https://jenkins.example.invalid';
    envMock.VITE_WS_BASE_URL = 'wss://jenkins.example.invalid/';

    const base = signalingBaseUrl({ protocol: 'https:', host: '192.168.0.5:5173' });

    expect(base).toBe('wss://jenkins.example.invalid');
  });
});
