import { act, renderHook } from '@testing-library/react';
import { useConsultSignaling } from './useConsultSignaling';

vi.mock('@/shared/api', () => ({
  publishConsultationFallbackEvent: vi.fn(),
}));

vi.mock('@/shared/config', () => ({
  env: { VITE_WS_BASE_URL: 'ws://localhost:8080' },
  rtcConfiguration: () => ({ iceServers: [] }),
}));

/** 열린 척만 하는 소켓. 이 테스트는 `onopen` 이후의 스트림 처리만 본다. */
class FakeSocket {
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor() {
    FakeSocket.instances.push(this);
  }
}

/** 협상은 이 테스트의 관심사가 아니다. 호출만 받아 넘긴다. */
class FakePeerConnection {
  signalingState = 'stable';
  connectionState = 'new';
  remoteDescription = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: (() => void) | null = null;
  onicecandidate: (() => void) | null = null;
  addTrack = vi.fn();
  close = vi.fn();
  createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: '' });
  createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: '' });
  setLocalDescription = vi.fn().mockResolvedValue(undefined);
  setRemoteDescription = vi.fn().mockResolvedValue(undefined);
  addIceCandidate = vi.fn().mockResolvedValue(undefined);
}

describe('useConsultSignaling', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    // jsdom 의 전역은 읽기 전용 프로퍼티라 대입 대신 정의로 바꾼다.
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'mediaDevices');
    vi.restoreAllMocks();
  });

  /**
   * 상담 화면을 금방 벗어나는 경우.
   *
   * 정리 함수가 먼저 지나가면 그 시점에는 아직 잡은 스트림이 없다. 뒤늦게 도착한 스트림을
   * 그냥 버리면 아무도 그것을 모르는 채 카메라와 마이크가 계속 켜져 있다.
   */
  it('연결 중에 화면을 벗어나면 뒤늦게 받은 카메라·마이크를 끈다', async () => {
    const stop = vi.fn();
    let resolveMedia: ((stream: MediaStream) => void) | undefined;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn(
          () =>
            new Promise<MediaStream>((resolve) => {
              resolveMedia = resolve;
            }),
        ),
      },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'USER', 'token-1'));

    // 소켓이 열려 getUserMedia 가 시작된 상태를 만든다.
    await act(async () => {
      FakeSocket.instances[0]?.onopen?.();
      await Promise.resolve();
    });

    // 응답이 오기 전에 화면을 떠난다.
    view.unmount();

    await act(async () => {
      resolveMedia?.({ getTracks: () => [{ stop }] } as unknown as MediaStream);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(stop).toHaveBeenCalledTimes(1);
  });
});
