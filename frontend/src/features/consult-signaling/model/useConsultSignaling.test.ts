import { act, renderHook } from '@testing-library/react';
import { useConsultSignaling } from './useConsultSignaling';

/**
 * 우회로 SSE. 테스트가 직접 이벤트를 밀어 넣는다.
 *
 * `vi.mock` 의 factory 는 끌어올려져 먼저 돌기 때문에, 그 안에서 쓰는 것은 `vi.hoisted`
 * 안에 두어야 한다. 바깥의 class 선언은 그 시점에 아직 초기화되지 않았다.
 */
const { FakeEventSource, apiMocks } = vi.hoisted(() => {
  class FakeEventSource {
    static instances: FakeEventSource[] = [];
    private readonly listeners = new Map<string, EventListener[]>();
    close = vi.fn();

    url: string;

    constructor(url: string) {
      this.url = url;
      FakeEventSource.instances.push(this);
    }

    addEventListener(name: string, listener: EventListener) {
      this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
    }

    emit(name: string, data: unknown) {
      this.listeners
        .get(name)
        ?.forEach((listener) => listener({ data: JSON.stringify(data) } as MessageEvent));
    }
  }

  return {
    FakeEventSource,
    apiMocks: { publishConsultationDataChannelEvent: vi.fn().mockResolvedValue(undefined) },
  };
});

vi.mock('@/shared/api', () => ({
  publishConsultationFallbackEvent: vi.fn().mockResolvedValue(undefined),
  publishConsultationDataChannelEvent: apiMocks.publishConsultationDataChannelEvent,
  subscribeToConsultationWaitingEvents: vi.fn(
    (consultationId: string) => new FakeEventSource(consultationId) as unknown as EventSource,
  ),
  // 서버 ICE 설정이 도착해야 연결이 시작된다. 테스트에서는 빈 목록으로 바로 넘긴다.
  getIceServers: vi.fn().mockResolvedValue({ iceServers: [] }),
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
  onclose: ((event: { code?: number; reason?: string }) => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor() {
    FakeSocket.instances.push(this);
  }
}

/** 서버 ICE 설정을 받은 뒤에야 소켓이 열린다. 그 사이의 마이크로태스크를 흘려보낸다. */
async function flushSetup() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function fakeTrack(kind: 'video' | 'audio') {
  return {
    kind,
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStreamTrack & { stop: ReturnType<typeof vi.fn> };
}

function fakeStream(tracks: MediaStreamTrack[]) {
  return {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
    getAudioTracks: () => tracks.filter((track) => track.kind === 'audio'),
  } as unknown as MediaStream;
}

/** jsdom 에는 MediaStream 이 없다. 트랙을 모아 두기만 하는 최소 구현으로 대신한다. */
class FakeMediaStream {
  private readonly tracks: MediaStreamTrack[];

  constructor(tracks: MediaStreamTrack[] = []) {
    this.tracks = tracks;
  }

  getTracks() {
    return this.tracks;
  }

  getVideoTracks() {
    return this.tracks.filter((track) => track.kind === 'video');
  }

  getAudioTracks() {
    return this.tracks.filter((track) => track.kind === 'audio');
  }
}

type ResultHandler = (event: {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}) => void;

/** 브라우저 음성 인식 대신 테스트가 직접 결과를 밀어 넣는다. */
class FakeRecognition {
  static instances: FakeRecognition[] = [];
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ResultHandler | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();

  constructor() {
    FakeRecognition.instances.push(this);
  }
}

/** 협상은 이 테스트의 관심사가 아니다. 호출만 받아 넘긴다. */
class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  signalingState = 'stable';
  connectionState = 'new';
  remoteDescription: RTCSessionDescriptionInit | null = null;
  localDescription: (RTCSessionDescriptionInit & { toJSON: () => unknown }) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  ontrack: (() => void) | null = null;
  onicecandidate: (() => void) | null = null;
  addTrack = vi.fn();
  close = vi.fn();
  createDataChannel = vi.fn(() => ({ readyState: 'connecting', send: vi.fn(), onmessage: null }));
  addTransceiver = vi.fn();
  createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: '' });
  createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' });
  setLocalDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.localDescription = { ...description, toJSON: () => description };
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
  });
  setRemoteDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.remoteDescription = description;
  });
  addIceCandidate = vi.fn().mockResolvedValue(undefined);

  constructor() {
    FakePeerConnection.instances.push(this);
  }
}

/** 상담자가 보내오는 offer 한 통. */
function offerMessage(sdp: string) {
  return {
    data: JSON.stringify({
      sessionId: 'room_1',
      senderType: 'COUNSELOR',
      type: 'OFFER',
      payload: { type: 'offer', sdp },
      timestamp: '',
    }),
  } as MessageEvent;
}

function sentTypes(socket: FakeSocket | undefined) {
  return (socket?.send.mock.calls ?? []).map(
    ([raw]) => (JSON.parse(String(raw)) as { type: string }).type,
  );
}

describe('useConsultSignaling', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    FakeRecognition.instances = [];
    FakePeerConnection.instances = [];
    FakeEventSource.instances = [];
    apiMocks.publishConsultationDataChannelEvent.mockClear();
    // jsdom 의 전역은 읽기 전용 프로퍼티라 대입 대신 정의로 바꾼다.
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    vi.stubGlobal('MediaStream', FakeMediaStream);
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
    const videoTrack = fakeTrack('video');
    const audioTrack = fakeTrack('audio');
    let resolveVideo: ((stream: MediaStream) => void) | undefined;

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        // 화면 공유는 지원하지 않는 브라우저로 둔다. 카메라·마이크가 늦게 도착한다.
        getUserMedia: vi.fn(
          () =>
            new Promise<MediaStream>((resolve) => {
              resolveVideo = resolve;
            }),
        ),
      },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'USER', 'token-1'));
    await flushSetup();

    // 소켓이 열려 미디어 확보가 시작된 상태를 만든다.
    await act(async () => {
      FakeSocket.instances[0]?.onopen?.();
      await Promise.resolve();
    });

    // 응답이 오기 전에 화면을 떠난다.
    view.unmount();

    await act(async () => {
      resolveVideo?.(fakeStream([videoTrack, audioTrack]));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(videoTrack.stop).toHaveBeenCalledTimes(1);
    expect(audioTrack.stop).toHaveBeenCalledTimes(1);
  });

  /** 사용자 화면을 공유해야 상담자가 지도 위에 길을 그려 줄 수 있다. */
  it('사용자는 카메라가 아니라 화면을 공유한다', async () => {
    const getDisplayMedia = vi.fn().mockResolvedValue(fakeStream([fakeTrack('video')]));
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')]));
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, getDisplayMedia },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'USER', 'token-1'));
    await flushSetup();

    await act(async () => {
      FakeSocket.instances[0]?.onopen?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getDisplayMedia).toHaveBeenCalled();
    // 마이크만 장치에서 받는다. 카메라 영상은 요청하지 않는다.
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(getUserMedia).not.toHaveBeenCalledWith(expect.objectContaining({ video: true }));
    expect(view.result.current.screenShareBlocked).toBe(false);

    view.unmount();
  });

  /** 화면 공유를 거절해도 상담 자체는 이어져야 한다. 대신 다시 공유하라고 알린다. */
  it('화면 공유가 막히면 카메라로 물러나고 다시 공유할 수 있다고 알린다', async () => {
    const getDisplayMedia = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    const getUserMedia = vi.fn((constraints: MediaStreamConstraints) =>
      Promise.resolve(fakeStream([fakeTrack(constraints.video ? 'video' : 'audio')])),
    );
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, getDisplayMedia },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'USER', 'token-1'));
    await flushSetup();

    await act(async () => {
      FakeSocket.instances[0]?.onopen?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: true });
    expect(view.result.current.screenShareBlocked).toBe(true);

    view.unmount();
  });

  /**
   * 상담 전문은 종료 뒤 AI 요약의 유일한 입력이다. 말하는 도중 계속 고쳐 쓰이는 중간 결과까지
   * 담으면 같은 문장이 여러 번 들어간 전문이 요약으로 넘어간다.
   */
  it('양쪽의 확정된 자막만 순서대로 상담 전문에 쌓는다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn((constraints: MediaStreamConstraints) =>
          Promise.resolve(fakeStream([fakeTrack(constraints.video ? 'video' : 'audio')])),
        ),
      },
    });
    vi.stubGlobal('SpeechRecognition', FakeRecognition);

    const view = renderHook(() => useConsultSignaling('room_1', 'COUNSELOR', 'token-1'));
    await flushSetup();

    await act(async () => {
      FakeSocket.instances[0]?.onopen?.();
      await Promise.resolve();
      await Promise.resolve();
    });

    const recognition = FakeRecognition.instances[0];
    const speak = (transcript: string, isFinal: boolean) =>
      recognition?.onresult?.({ resultIndex: 0, results: [{ isFinal, 0: { transcript } }] });

    await act(async () => {
      speak('어디로', false);
      speak('어디로 가시나요', true);
      FakeSocket.instances[0]?.onmessage?.({
        data: JSON.stringify({
          sessionId: 'room_1',
          senderType: 'USER',
          type: 'CAPTION',
          payload: { text: '3번 출구요', final: true, language: 'ko-KR' },
          timestamp: '',
        }),
      } as MessageEvent);
      await Promise.resolve();
    });

    expect(view.result.current.transcript).toEqual([
      { seq: 1, speaker: 'COUNSELOR', content: '어디로 가시나요' },
      { seq: 2, speaker: 'USER', content: '3번 출구요' },
    ]);

    view.unmount();
  });

  /**
   * 상담자 마이크 하나가 막혔다고 상담 전체가 멈추면 안 된다.
   *
   * 협상과 자막이 미디어 확보와 한 덩어리로 묶여 있던 탓에, 마이크를 얻지 못한 상담자는
   * offer 를 아예 만들지 않았다. 사용자 화면은 상담자에게 끝내 도착하지 않고 양쪽 자막도
   * 뜨지 않는데, 화면에는 원인 대신 한참 뒤의 연결 종료 안내만 남았다.
   */
  it('상담자 마이크를 얻지 못해도 offer 를 보내고 자막을 시작한다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
    });
    vi.stubGlobal('SpeechRecognition', FakeRecognition);

    const view = renderHook(() => useConsultSignaling('room_1', 'COUNSELOR', 'token-1'));
    await flushSetup();

    await act(async () => {
      FakeSocket.instances[0]?.onopen?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const peer = FakePeerConnection.instances[0];
    // 사용자 화면과 목소리를 받을 자리는 보낼 트랙이 없어도 만들어야 한다.
    expect(peer?.addTransceiver).toHaveBeenCalledWith('video', { direction: 'recvonly' });
    expect(peer?.addTransceiver).toHaveBeenCalledWith('audio', { direction: 'recvonly' });
    expect(sentTypes(FakeSocket.instances[0])).toContain('OFFER');
    expect(FakeRecognition.instances[0]?.start).toHaveBeenCalled();
    // 연결이 맺어져도 지워지면 안 되는 안내다. 상담자는 자기 목소리가 나가지 않음을 알아야 한다.
    expect(view.result.current.error).toBe('화면 공유 또는 마이크를 사용할 수 없습니다.');

    view.unmount();
  });

  /**
   * 상담자는 answer 를 받을 때까지 같은 offer 를 되풀이해 보낸다. 답한 직후 도착한 재전송을
   * 새 상담자로 오해해 연결을 다시 맺으면, 상담자는 이미 answer 를 적용해 두어 다시는
   * offer 를 만들지 않으므로 화면 공유가 영영 뜨지 않는다.
   */
  it('이미 답한 offer 가 다시 와도 연결을 새로 맺지 않고 answer 만 다시 보낸다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('video')])),
        getUserMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')])),
      },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'USER', 'token-1'));
    await flushSetup();

    const socket = FakeSocket.instances[0];
    await act(async () => {
      socket?.onopen?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      socket?.onmessage?.(offerMessage('same-offer'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // 같은 offer 가 한 번 더 도착한다.
    await act(async () => {
      socket?.onmessage?.(offerMessage('same-offer'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // 연결을 다시 맺었다면 소켓과 peer 가 하나씩 더 생겼을 것이다.
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakePeerConnection.instances).toHaveLength(1);
    // 상담자가 놓쳤을 수 있으니 답은 다시 보낸다.
    expect(sentTypes(socket).filter((type) => type === 'ANSWER')).toHaveLength(2);
    expect(view.result.current.error).toBeNull();

    view.unmount();
  });

  /**
   * signaling 토큰은 10분이면 만료되는데 상담은 그보다 오래간다.
   *
   * 예전에는 한 번 받은 토큰을 상담이 끝날 때까지 그대로 썼다. 연결을 다시 맺어야 하는
   * 순간(상대가 새로고침했거나 망이 끊긴 때) handshake 가 401 로 거절되고 그대로 끝이었다.
   * 상대 화면에는 `연결 상태: signaling` 만 남고 화면 공유는 영영 도착하지 않았다.
   */
  it('handshake 가 거절되면 곧바로 실패로 남기지 않고 새 토큰을 받아 오라고 알린다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')])) },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'COUNSELOR', 'token-expired'));
    await flushSetup();

    expect(view.result.current.tokenRejected).toBe(0);

    // 한 번도 열리지 못한 채 닫힌다. 만료된 토큰이 거절당한 모습이다.
    await act(async () => {
      FakeSocket.instances[0]?.onclose?.({ code: 1006 });
      await Promise.resolve();
    });

    expect(view.result.current.tokenRejected).toBe(1);
    // 새 토큰으로 붙을 수 있다. 여기서 실패로 단정하면 화면이 회복을 포기한다.
    expect(view.result.current.error).toBeNull();

    view.unmount();
  });

  /** 새 토큰으로도 계속 거절당하면 만료 문제가 아니다. 그때는 사실대로 알려야 한다. */
  it('토큰을 새로 받아도 계속 거절당하면 연결 실패로 알린다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')])) },
    });

    const view = renderHook(
      ({ token }) => useConsultSignaling('room_1', 'COUNSELOR', token),
      { initialProps: { token: 'token-1' } },
    );
    await flushSetup();

    // 토큰을 새로 받아 다시 붙어 보기를 되풀이한다.
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await act(async () => {
        FakeSocket.instances.at(-1)?.onclose?.({ code: 1006 });
        await Promise.resolve();
      });
      view.rerender({ token: `token-${attempt + 1}` });
      await flushSetup();
    }

    expect(view.result.current.error).toContain('상담 연결 서버에 접속하지 못했습니다.');

    view.unmount();
  });

  /**
   * 상대가 새로고침하면 새 offer 가 온다. 이쪽은 연결을 통째로 다시 맺어야 하는데, 그때
   * `LEAVE` 를 보내면 서버 방에서 지워진다. 상대가 2초마다 보내는 offer 는 갈 곳을 잃고,
   * 상대 화면은 `연결 상태: signaling` 에서 멈춘다.
   */
  it('새 offer 를 받아 연결을 다시 맺을 때는 방에서 나갔다고 알리지 않는다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('video')])),
        getUserMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')])),
      },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'USER', 'token-1'));
    await flushSetup();

    const first = FakeSocket.instances[0];
    await act(async () => {
      first?.onopen?.();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // 첫 offer 에 답해 협상을 끝낸다.
    await act(async () => {
      first?.onmessage?.(offerMessage('first-offer'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(sentTypes(first)).toContain('ANSWER');

    // 상담자가 새로고침해 전혀 다른 offer 를 보내온다.
    await act(async () => {
      first?.onmessage?.(offerMessage('offer-after-counselor-reload'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // 연결은 통째로 다시 맺되, 방에서 나갔다고 알리면 안 된다.
    expect(FakePeerConnection.instances.length).toBeGreaterThan(1);
    expect(sentTypes(first)).not.toContain('LEAVE');

    view.unmount();
  });

  /**
   * 자막이 안 된다는 사실은 이쪽 화면에만 남아서는 소용이 없다.
   *
   * Chrome 이 아닌 브라우저로 상담을 받으면 상대 화면에는 아무 경고 없이 "말하면 이 자리에
   * 표시됩니다"만 상담 내내 떠 있었다. 자막이 고장난 것인지 이쪽이 조용한 것인지 구분할
   * 방법이 없어, 상대는 오지 않을 자막을 계속 기다렸다.
   */
  it('음성 인식을 지원하지 않는 브라우저면 그 사실을 상대에게 알린다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')])) },
    });
    // SpeechRecognition 을 stub 하지 않는다. 지원하지 않는 브라우저다.

    const view = renderHook(() => useConsultSignaling('room_1', 'COUNSELOR', 'token-1'));
    await flushSetup();

    const socket = FakeSocket.instances[0];
    const statuses = (socket?.send.mock.calls ?? [])
      .map(([raw]) => JSON.parse(String(raw)) as { type: string; payload?: { captionStatus?: string } })
      .filter((message) => message.type === 'CAPTION')
      .map((message) => message.payload?.captionStatus);

    expect(statuses).toContain('unsupported');
    expect(view.result.current.captionsSupported).toBe(false);

    view.unmount();
  });

  /**
   * 상대가 아직 방에 없을 때 보낸 경고는 서버가 버린다. 붙은 뒤에 다시 알리지 않으면
   * 상대는 끝내 알지 못한다.
   */
  it('연결이 맺어지면 앞서 보낸 자막 경고를 다시 알린다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')])) },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'COUNSELOR', 'token-1'));
    await flushSetup();

    const socket = FakeSocket.instances[0];
    const captionSends = () =>
      (socket?.send.mock.calls ?? [])
        .map(([raw]) => JSON.parse(String(raw)) as { type: string })
        .filter((message) => message.type === 'CAPTION').length;

    const before = captionSends();

    const peer = FakePeerConnection.instances[0];
    await act(async () => {
      if (peer) peer.connectionState = 'connected';
      peer?.onconnectionstatechange?.();
      await Promise.resolve();
    });

    expect(captionSends()).toBeGreaterThan(before);

    view.unmount();
  });

  /** 경고 한 통 때문에 마지막으로 들은 말까지 지워지면 화면이 더 비어 보인다. */
  it('상대의 자막 경고를 받아도 지금 떠 있는 자막은 그대로 둔다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('video')])),
        getUserMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')])),
      },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'USER', 'token-1'));
    await flushSetup();

    const socket = FakeSocket.instances[0];
    const caption = (payload: unknown) =>
      socket?.onmessage?.({
        data: JSON.stringify({
          sessionId: 'room_1',
          senderType: 'COUNSELOR',
          type: 'CAPTION',
          payload,
          timestamp: '',
        }),
      } as MessageEvent);

    await act(async () => {
      caption({ text: '3번 출구로', final: false, language: 'ko-KR' });
      await Promise.resolve();
    });

    // 말하는 도중이라 아직 확정된 문장이 아니다.
    expect(view.result.current.remoteCaption).toBe('3번 출구로');
    expect(view.result.current.remoteCaptionFinal).toBe(false);

    await act(async () => {
      caption({ captionStatus: 'network' });
      await Promise.resolve();
    });

    expect(view.result.current.remoteCaptionError).toBe('network');
    expect(view.result.current.remoteCaption).toBe('3번 출구로');

    // 한 마디라도 다시 오면 경고는 더 이상 사실이 아니다.
    await act(async () => {
      caption({ text: '3번 출구로 가세요', final: true, language: 'ko-KR' });
      await Promise.resolve();
    });

    expect(view.result.current.remoteCaptionError).toBeNull();
    expect(view.result.current.remoteCaptionFinal).toBe(true);
    expect(view.result.current.remoteFinalCaption).toBe('3번 출구로 가세요');

    view.unmount();
  });

  /**
   * DataChannel 이 열리지 않은 상담에서도 상담자가 그린 선은 사용자에게 닿아야 한다.
   *
   * 예전에는 여기서 조용히 버려서, 상담자는 사용자가 보고 있다고 믿은 채 화면에 아무것도
   * 뜨지 않는 설명을 이어 갔다.
   */
  it('DataChannel 이 닫혀 있으면 상담 이벤트를 서버 우회로로 보낸다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')])) },
    });

    const view = renderHook(() => useConsultSignaling('room_1', 'COUNSELOR', 'token-1'));
    await flushSetup();

    // createDataChannel 은 아직 'connecting' 이다. 이 길로는 보낼 수 없다.
    let accepted = false;
    await act(async () => {
      accepted = view.result.current.sendConsultEvent({ eventType: 'DRAW_CLEAR', payload: {} });
      await Promise.resolve();
    });

    expect(accepted).toBe(true);
    expect(apiMocks.publishConsultationDataChannelEvent).toHaveBeenCalledWith(
      // roomId 의 'room_' 접두사를 뗀 상담 ID 로 올린다.
      '1',
      expect.objectContaining({ type: 'DRAW_CLEAR' }),
    );

    view.unmount();
  });

  /** 우회로로 온 이벤트도 DataChannel 로 온 것과 똑같이 화면에 옮겨야 한다. */
  it('사용자는 우회로 SSE 로 온 상담 이벤트를 받고 같은 이벤트는 한 번만 처리한다', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getDisplayMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('video')])),
        getUserMedia: vi.fn().mockResolvedValue(fakeStream([fakeTrack('audio')])),
      },
    });

    const onDataEvent = vi.fn();
    const view = renderHook(() => useConsultSignaling('room_1', 'USER', 'token-1', onDataEvent));
    await flushSetup();

    const stream = FakeEventSource.instances[0];
    // roomId 의 'room_' 접두사를 뗀 상담 ID 로 구독한다.
    expect(stream?.url).toBe('1');

    const drawn = {
      eventType: 'DRAW_CLEAR',
      payload: {},
      sessionId: 'room_1',
      eventId: 'evt_1',
      senderType: 'COUNSELOR',
      timestamp: '',
      version: 1,
    };

    await act(async () => {
      stream?.emit('DATA_CHANNEL', { payload: drawn });
      // 같은 이벤트가 DataChannel 과 우회로로 각각 올 수 있다.
      stream?.emit('DATA_CHANNEL', { payload: drawn });
      // 사용자가 보낸 것이 되돌아온 것은 화면에 옮기지 않는다.
      stream?.emit('DATA_CHANNEL', {
        payload: { ...drawn, eventId: 'evt_2', senderType: 'USER' },
      });
      await Promise.resolve();
    });

    expect(onDataEvent).toHaveBeenCalledTimes(1);
    expect(onDataEvent).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt_1' }));

    view.unmount();
    expect(stream?.close).toHaveBeenCalled();
  });
});
