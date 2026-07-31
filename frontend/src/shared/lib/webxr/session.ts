import { toPoseReading } from './pose';
import { createPoseSampler, DEFAULT_SAMPLING_RULE } from './sampler';
import { detectXrSupport } from './support';
import type {
  XrFailureReason,
  XrPoseReading,
  XrPoseSnapshot,
  XrSamplingRule,
  XrTrackingStatus,
} from './types';

/**
 * pose가 이 시간(ms) 이상 연속으로 없으면 추적 상실로 본다.
 *
 * **확정값이 아니다.** 11.7은 판별 기준을 "연속 null"이라고만 두고 숫자를 정하지 않았다.
 * 이 값은 다음 실측 사이에서 잡은 임시값이며, 실기기 테스트로 조정한다.
 *
 * | 상황 | 최장 연속 결손 |
 * | --- | --- |
 * | 평지·계단 (정상) | 약 1초 |
 * | 엘리베이터 (추적 붕괴) | 약 7초 |
 *
 * 1초 이하로 내리면 계단에서도 상실로 잡히고, 크게 올리면 엘리베이터에서 화면이 멈춘 것처럼
 * 보이는 구간이 길어진다.
 */
export const PROVISIONAL_TRACKING_LOST_MS = 1500;

/**
 * requestSession 실패까지 이 시간(ms) 미만이면 이미 차단된 권한으로 본다.
 *
 * 실측값은 차단 상태 10ms, 프롬프트가 뜬 경우 2.0~25.3초였다. 11.7은 이 임계값을 그 사이에서
 * 잡되 **표본이 적어 보조 신호로만 쓰고 단독 판단 근거로 삼지 않는다**고 정한다.
 */
const PERMISSION_BLOCKED_MS = 500;

/**
 * reference space 후보. `local`을 우선한다.
 *
 * 1차 실기기 검증에서 `local`이 첫 후보로 성공했다. 없는 기기도 있어 순서대로 시도한다.
 * 층 계산에 높이 절대값을 쓰지 않으므로(11.2) `local-floor`가 아니어도 무관하다.
 *
 * **`viewer`는 후보에 넣지 않는다.** 검증 페이지는 어떤 공간이 존재하는지 알아보려고 후보에
 * 넣었지만, `viewer` 공간에서 `getViewerPose`는 뷰어 자신을 기준으로 한 뷰어의 pose를
 * 돌려주므로 위치가 영원히 원점이다. 그대로 쓰면 pose가 있으니 `tracking`으로 보이는데
 * 이동은 한 번도 감지되지 않아 **조용히 틀린 위치를 내보낸다.** 상대 위치 추적이라는 이
 * 모듈의 목적을 채울 수 없으므로 실패로 알리고 11.7의 fallback 경로를 타게 한다.
 */
const REFERENCE_SPACE_CANDIDATES: readonly XRReferenceSpaceType[] = ['local', 'local-floor'];

/**
 * 세션 시작 시 함께 요청하는 기능을 정한다.
 *
 * - dom-overlay: 세션 중에도 앱 UI를 카메라 위에 얹는다(11.8).
 * - camera-access: 세션을 유지한 채 VPS 프레임을 확보한다. 세션 도중에 기능을 추가할 수
 *   없으므로 시작 시 함께 요청한다(11.7).
 *
 * 둘 다 optional이다. 부여되지 않아도 세션 자체는 열려야 하고 추적은 계속 가능하다.
 *
 * **`dom-overlay`는 root가 있을 때만 요청한다.** DOM Overlay 명세는 `domOverlay`가 없으면
 * 이 기능을 지원되지 않는 것으로 처리하므로, root 없이 요청하면 어차피 부여되지 않는다.
 * 그런데 2차 실기기 검증에서 **기능마다 각자 동의 프롬프트가 떴다**(11.7). 얻을 수도 없는
 * 기능 때문에 사용자에게 프롬프트를 하나 더 보여줄 이유가 없다.
 */
function optionalFeaturesFor(domOverlayRoot: HTMLElement | undefined): string[] {
  return domOverlayRoot ? ['dom-overlay', 'camera-access'] : ['camera-access'];
}

/**
 * 화면에 노출되는 추적 상태. 직렬화 가능한 값만 담는다.
 *
 * XRSession과 XRReferenceSpace는 여기에 넣지 않는다(`frontend/AGENTS.md`).
 */
export interface XrSessionState {
  status: XrTrackingStatus;
  /** status가 failed일 때의 사유. */
  reason?: XrFailureReason;
  /** 실제로 확보된 reference space 종류. */
  referenceSpaceType?: XRReferenceSpaceType;
}

export interface XrSessionControllerOptions {
  /** 테스트에서 가짜 XRSystem을 주입한다. 기본값은 start 시점의 navigator.xr이다. */
  xr?: XRSystem;
  /** 확정 주기 기준값. */
  rule?: XrSamplingRule;
  /** requestSession 소요 시간 측정용 시계. */
  now?: () => DOMHighResTimeStamp;
  /** 추적 상실 판정 임계값(ms). */
  trackingLostAfterMs?: number;
  /**
   * 세션에 렌더 레이어를 붙인다. 성공하면 true.
   *
   * 기본값은 `xrCompatible` WebGL 컨텍스트를 만들어 `XRWebGLLayer`를 연결한다. 테스트에서
   * 주입하는 것은 jsdom에 WebGL이 없어서다 — 레이어 연결 자체는 실기기 검증 대상이며
   * (S15P11A206-141), 여기서 검사하는 것은 그 성공·실패가 세션 흐름을 어떻게 가르는지다.
   */
  attachRenderLayer?: (session: XRSession) => Promise<boolean>;
}

export interface XrStartOptions {
  /**
   * dom-overlay로 카메라 위에 얹을 DOM. 넘기지 않으면 dom-overlay 없이 세션을 연다.
   *
   * 이 root를 어느 컴포넌트가 소유하고 라우트 전환에도 어떻게 살려둘지는 S15P11A206-141의
   * 화면 구조에서 정한다. root는 세션을 열 때 한 번 정해지고 도중에 바꿀 수 없다.
   */
  domOverlayRoot?: HTMLElement;
  /**
   * requestSession 직전에 카메라 자원을 반납하는 콜백.
   *
   * **getUserMedia와 immersive-ar 세션은 공존하지 못한다.** 미리보기를 켠 채 세션을 열면
   * 세션·reference space·dom-overlay가 모두 성공하는데 getViewerPose가 전 프레임 null이고
   * 카메라도 검은 화면이 된다. 예외도 오류 이벤트도 없이 조용히 실패한다(11.8).
   *
   * 이 모듈은 스트림을 소유하지 않으므로 정리 책임을 호출하는 쪽에 위임한다.
   * 스트림을 쓰는 화면은 `stopMediaStream`으로 트랙을 정지하고 video의 srcObject도
   * null로 되돌린 뒤 이 콜백이 끝나게 해야 한다.
   */
  releaseCamera?: () => void | Promise<void>;
}

export interface XrSessionController {
  /** 현재 상태. */
  getState(): XrSessionState;
  /**
   * 현재 열려 있는 세션의 식별자. 열려 있지 않으면 null이다.
   *
   * 세션을 연 화면이 "지금 열려 있는 것이 내가 연 그 세션인지"를 판별하는 데 쓴다.
   * 컨트롤러가 앱 공용 싱글턴이므로, 이 확인 없이 언마운트에서 stop을 부르면 다른 화면이
   * 새로 연 세션을 끊을 수 있다. 세션이 열릴 때마다 새 값이 부여된다.
   */
  getSessionId(): number | null;
  /** 상태가 바뀔 때만 호출된다. 매 프레임 호출되지 않는다. */
  subscribe(listener: (state: XrSessionState) => void): () => void;
  /** 11.4 확정 주기를 통과한 스냅샷만 전달된다. 받는 쪽에서 다시 throttle하지 않는다. */
  subscribeSnapshots(listener: (snapshot: XrPoseSnapshot) => void): () => void;
  /**
   * 마지막 프레임의 pose. 추적 중이 아니면 null이다.
   *
   * **위치 갱신에 쓰지 않는다.** 위치 갱신은 `subscribeSnapshots`가 담당하며, 이 값을
   * 주기적으로 읽는 것은 11.4가 제거한 "매 프레임 갱신"을 되살리는 것이다.
   *
   * 용도는 하나다 — **앵커 생성 시점의 pose를 집는 것.** 앵커는 지도 좌표와 XR 좌표를 한
   * 쌍으로 묶는데, 그 둘이 같은 순간의 값이어야 한다. 스냅샷은 확정 주기로 걸러지므로
   * VPS 응답이 도착한 순간과 최대 5초까지 벌어진다(11.4).
   */
  getLatestReading(): XrPoseReading | null;
  /**
   * 세션을 시작한다.
   *
   * 이미 열려 있거나 시작 중이면 새 세션을 만들지 않는다. XR 세션은 한 번에 하나만 열 수 있다.
   */
  start(options?: XrStartOptions): Promise<XrSessionState>;
  /** 세션을 끝내고 추적 자원을 정리한다. 열려 있지 않으면 아무 일도 하지 않는다. */
  stop(): Promise<void>;
}

/**
 * WebXR 세션 생명주기와 pose 추적 루프를 관리하는 컨트롤러를 만든다.
 *
 * XRSession·XRReferenceSpace·XRFrame은 이 클로저 밖으로 나가지 않는다. 바깥에 전달하는 것은
 * 상태 문자열과 확정된 스냅샷뿐이다. 매 프레임 전역 상태나 UI를 갱신하지 않기 위한 구조이며,
 * XR 객체를 Zustand에 저장하지 않는다는 `frontend/AGENTS.md` 규칙도 이렇게 지킨다.
 *
 * 앱에서는 이 함수를 직접 부르지 말고 모듈 싱글턴 `xrSessionController`를 쓴다. 컨트롤러가
 * 여러 개면 중복 세션 방지가 컨트롤러 단위로만 걸려 두 화면이 동시에 세션을 열 수 있다.
 * 이 함수는 테스트에서 XRSystem을 주입하기 위한 것이다.
 */
export function createXrSessionController(
  options: XrSessionControllerOptions = {},
): XrSessionController {
  const {
    rule = DEFAULT_SAMPLING_RULE,
    now = () => performance.now(),
    trackingLostAfterMs = PROVISIONAL_TRACKING_LOST_MS,
  } = options;

  let state: XrSessionState = { status: 'idle' };
  const stateListeners = new Set<(state: XrSessionState) => void>();
  const snapshotListeners = new Set<(snapshot: XrPoseSnapshot) => void>();

  let session: XRSession | null = null;
  let referenceSpace: XRReferenceSpace | null = null;

  /**
   * XR 컴포지터가 그릴 대상.
   *
   * **`baseLayer`가 없으면 immersive 세션은 프레임을 만들지 않는다.** `requestSession`과
   * `requestReferenceSpace`가 모두 성공해도 `requestAnimationFrame` 콜백이 오지 않아
   * pose가 영원히 없고, 카메라 영상도 화면에 나오지 않는다. 검증 페이지가 이 레이어를
   * 붙였기 때문에 1~3차 실측이 성립했다.
   *
   * 이 모듈은 3D를 그리지 않는다. 레이어는 **카메라를 통과시키기 위한 투명 표면**으로만 쓴다 —
   * 매 프레임 알파 0으로 지워서, ARCore가 뒤에 합성한 카메라 영상이 그대로 보이게 한다.
   * 지도와 안내 UI는 그 위에 `dom-overlay`로 얹힌다(11.8).
   *
   * `webgl2`로 만드는 것은 11.8의 결정이다. `getCameraImage` 텍스처의 비동기 리드백에
   * 쓰이는 PBO가 WebGL2 기능이라, 나중에 그 경로를 붙일 때 컨텍스트를 다시 만들지 않아도 된다.
   */
  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  let sampler = createPoseSampler(rule);
  let startInFlight: Promise<XrSessionState> | null = null;
  let frameHandle: number | null = null;

  /**
   * 마지막으로 pose가 들어온 프레임 시각.
   *
   * null이면 아직 추적이 잡히지 않은 것이다(warming-up). 실측에서 reference space 확보 후에도
   * 0.96~1.54초 동안 getViewerPose가 null이므로, 이 구간을 추적 상실과 구분해야 한다.
   */
  let lastPoseAt: DOMHighResTimeStamp | null = null;

  /**
   * 마지막 프레임에서 읽은 pose. 확정 주기를 거치지 않은 원시 관측값이다.
   *
   * 앵커를 만들려면 "VPS가 좌표를 확정한 그 순간"의 pose가 필요한데, 스냅샷 스트림으로는
   * 그 순간을 잡을 수 없다. 확정 주기가 정지 상태에서 5초 heartbeat이므로 최대 5초 뒤의
   * pose와 짝지어지고, 보행 중이면 2m 이상 이동한 pose와 짝지어진다(11.4). 앵커가 어긋나면
   * 이후 모든 변환 결과가 같은 양만큼 어긋나므로, 앵커 생성에는 걸러지지 않은 최신 값을 쓴다.
   *
   * 추적이 잡히기 전(warming-up)과 정리 후에는 null이다. 추적 상실 구간에서는 상실 직전
   * 값이 남는데, 이는 `getState().status`로 구분한다 — 상실 중에 앵커를 만들지 않는 판단은
   * 이 값을 쓰는 쪽의 몫이다.
   */
  let latestReading: XrPoseReading | null = null;

  /**
   * start가 끝나기 전에 stop이 호출됐는지.
   *
   * 세션 객체는 `requestSession`이 resolve된 뒤에야 존재한다. 권한 프롬프트는 실측에서
   * 2.04~25.29초 걸렸고, 그 사이에 사용자가 화면을 벗어나면 언마운트 훅이 stop을 부르는데
   * 그 시점에는 닫을 세션이 없다. 이 표시가 없으면 뒤늦게 세션이 열리고 아무도 닫지 않는다.
   */
  let stopRequested = false;

  /**
   * 현재 세션의 식별자와 다음에 부여할 값.
   *
   * 세션이 열릴 때마다 새 값을 받고 정리될 때 null이 된다. 화면이 자기가 연 세션만 끊도록
   * 판별하는 데 쓴다.
   */
  let sessionId: number | null = null;
  let nextSessionId = 1;

  /**
   * start 시도 횟수.
   *
   * stop이 진행 중인 start를 기다리는 동안 새 start가 시작되면, 그 세션은 이 stop의 대상이
   * 아니다. 기다린 뒤 이 값이 바뀌었는지로 판별한다.
   */
  let startAttempt = 0;

  function setState(next: Partial<XrSessionState> & { status: XrTrackingStatus }): XrSessionState {
    const merged: XrSessionState = {
      status: next.status,
      reason: 'reason' in next ? next.reason : state.reason,
      referenceSpaceType:
        'referenceSpaceType' in next ? next.referenceSpaceType : state.referenceSpaceType,
    };

    if (
      merged.status === state.status &&
      merged.reason === state.reason &&
      merged.referenceSpaceType === state.referenceSpaceType
    ) {
      return state;
    }

    state = merged;
    stateListeners.forEach((listener) => {
      listener(state);
    });

    return state;
  }

  function onFrame(time: DOMHighResTimeStamp, frame: XRFrame): void {
    const current = session;

    if (!current || !referenceSpace) {
      return;
    }

    frameHandle = current.requestAnimationFrame(onFrame);

    clearToTransparent(current);

    const viewerPose = frame.getViewerPose(referenceSpace);

    if (!viewerPose) {
      /**
       * 추적이 한 번이라도 잡힌 뒤에만 상실로 판정한다.
       *
       * 세션 시작 직후의 pose 없는 구간은 warming-up이며, 이 구간에는 확정 위치를 만들지
       * 않는다(11.4). 여기서 상태를 바꾸지 않으므로 확정도 나가지 않는다.
       *
       * warming-up에서 자동으로 lost로 넘어가지는 않는다. 넘어갈 시점을 정하려면 warm-up
       * 상한값이 필요한데 실측 최대치(1.54초)와 임계값이 겹쳐 확정할 수 없다. pose가 끝까지
       * 안 들어오는 경우(11.8의 카메라 자원 충돌)는 warming-up이 유지되며, 화면에는 141의
       * "추적 준비 중" 표시가 계속 보인다.
       */
      if (lastPoseAt !== null && time - lastPoseAt >= trackingLostAfterMs) {
        setState({ status: 'lost' });
      }

      return;
    }

    const recovered = state.status === 'lost';

    lastPoseAt = time;
    setState({ status: 'tracking' });

    /**
     * 추적 상실에서 복구된 경우 샘플러를 초기화한다.
     *
     * 상실 구간 동안 상대 좌표의 연속성이 이미 끊겼다. 초기화하지 않으면 복구 첫 프레임이
     * 상실 이전의 확정과 비교되어, 경과 시간이 heartbeat를 넘었으니 스냅샷이 하나 발화하고
     * 이동량이 2m를 넘었으면 `move`가 붙는다. **position 값 자체는 현재 pose라 맞지만
     * `move`라는 라벨의 의미가 틀린다** — 엘리베이터로 실려 갔거나 ARCore가 재측위하며
     * 추정치를 갈아엎은 경우 "직전 확정 이후 2m를 걸었다"가 성립하지 않는다. 실측에서도
     * blackout 사이에 반환된 pose는 값이 틀렸다(11.2).
     *
     * 초기화하면 복구 첫 스냅샷이 `first`가 되어 "연속성이 끊겼으니 이전 확정과의 차이를
     * 이동으로 해석하지 말라"는 신호가 된다. 11.7의 "복구되면 자동 재개"와 충돌하지 않는다.
     * 재개는 그대로 일어나고 라벨만 정확해진다.
     */
    if (recovered) {
      sampler.reset();
    }

    const reading = toPoseReading(viewerPose, time);

    latestReading = reading;

    /** 확정 주기 판정은 샘플러가 한다. 통과한 프레임만 바깥으로 나간다. */
    const snapshot = sampler.consider(reading);

    if (snapshot) {
      snapshotListeners.forEach((listener) => {
        listener(snapshot);
      });
    }
  }

  /**
   * XR 레이어를 알파 0으로 지운다.
   *
   * `immersive-ar`의 blend mode는 ARCore에서 `alpha-blend`다. 즉 컴포지터가 카메라 영상 위에
   * 이 레이어를 알파 합성한다. 지우지 않으면 프레임버퍼 내용이 정의되지 않아 앞 프레임의
   * 잔상이나 검은 화면이 카메라를 덮을 수 있다. **비우는 것이 카메라를 보이게 하는 방법이다.**
   *
   * 픽셀을 읽지 않고 쓰기만 하므로 파이프라인을 flush하지 않는다. 11.8이 금지한 것은 동기
   * `readPixels`이며 여기에는 해당하지 않는다.
   */
  function clearToTransparent(current: XRSession): void {
    // 레이어를 직접 붙이지 않았으면(테스트에서 주입한 경우) 지울 대상도 없다.
    if (!gl) return;

    const layer = current.renderState.baseLayer;

    if (!layer) return;

    gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  /**
   * 세션에 렌더 레이어를 붙인다. 실패하면 false.
   *
   * `xrCompatible`을 컨텍스트 생성 시에 주고 `makeXRCompatible()`도 부른다. 앞의 것은 처음부터
   * XR 장치에 맞는 어댑터를 고르게 하고, 뒤의 것은 이미 만들어진 컨텍스트를 XR 장치로 옮긴다.
   * 어느 한쪽만으로 되는 기기가 갈리므로 둘 다 한다.
   */
  async function attachRenderLayer(opened: XRSession): Promise<boolean> {
    try {
      const element = document.createElement('canvas');

      /**
       * DOM에 붙이지 않는다. 컴포지터가 이 캔버스를 XR 표면으로만 쓰고 페이지에는 그리지 않는다.
       * 붙이면 화면에 빈 캔버스가 자리를 차지한다. 검증 페이지도 붙이지 않았고 실기기에서
       * 레이어 연결이 성공했다.
       */
      const context =
        element.getContext('webgl2', { xrCompatible: true }) ??
        // WebGL2가 없는 기기에서도 카메라는 보여야 한다. 리드백 경로만 나중에 못 쓴다(11.8).
        element.getContext('webgl', { xrCompatible: true });

      if (!context) return false;

      await context.makeXRCompatible();
      opened.updateRenderState({ baseLayer: new XRWebGLLayer(opened, context) });

      // 캔버스는 컨텍스트가 `gl.canvas`로 붙들고 있어 따로 참조를 두지 않아도 살아 있다.
      gl = context;

      return true;
    } catch {
      // 컨텍스트 생성·전환·레이어 연결 중 어디서 실패해도 세션을 쓸 수 없다는 결론은 같다.
      return false;
    }
  }

  /** GL 자원을 반납한다. 컨텍스트는 기기당 개수 제한이 있어 세션마다 새로 만들고 버린다. */
  function releaseRenderLayer(): void {
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    gl = null;
  }

  function onSessionEnd(): void {
    teardown();
    setState({ status: 'ended', reason: undefined });
  }

  /**
   * 화면을 벗어날 때 세션을 정리한다.
   *
   * `visibilitychange`는 쓰지 않는다. immersive 세션에 들어가면 문서가 hidden으로 바뀌는
   * 브라우저가 있어, 세션을 연 직후 스스로 종료시킬 수 있다.
   *
   * 라우트 전환과 컴포넌트 해제는 이 리스너가 아니라 호출하는 쪽의 stop()이 담당한다.
   */
  function attachUnloadListener(): () => void {
    const onPageHide = (): void => {
      void stop();
    };

    window.addEventListener('pagehide', onPageHide);

    return () => {
      window.removeEventListener('pagehide', onPageHide);
    };
  }

  let detachUnloadListener: (() => void) | null = null;

  function teardown(): void {
    if (frameHandle !== null) {
      session?.cancelAnimationFrame(frameHandle);
      frameHandle = null;
    }

    detachUnloadListener?.();
    detachUnloadListener = null;

    session?.removeEventListener('end', onSessionEnd);
    session = null;
    sessionId = null;
    referenceSpace = null;
    lastPoseAt = null;
    latestReading = null;
    releaseRenderLayer();
    sampler.reset();
  }

  /**
   * start 도중에 stop이 들어온 경우. 열린 세션을 쓰지 않고 즉시 닫는다.
   */
  async function abandon(opened: XRSession): Promise<XrSessionState> {
    try {
      await opened.end();
    } catch {
      // 이미 끝났거나 종료에 실패해도 더 할 수 있는 일이 없다.
    }

    // 레이어를 이미 붙인 뒤 버리는 경우가 있다. GL 컨텍스트는 개수 제한이 있어 남기지 않는다.
    releaseRenderLayer();

    return setState({ status: 'ended', reason: undefined, referenceSpaceType: undefined });
  }

  async function run(startOptions: XrStartOptions): Promise<XrSessionState> {
    const xr = options.xr ?? navigator.xr;

    stopRequested = false;
    startAttempt += 1;
    setState({ status: 'starting', reason: undefined, referenceSpaceType: undefined });

    if (!xr) {
      return setState({ status: 'failed', reason: 'no-xr-object' });
    }

    if ((await detectXrSupport(xr)) !== 'supported') {
      return setState({ status: 'failed', reason: 'unsupported' });
    }

    /**
     * 11.8: requestSession 전에 카메라 자원을 반납한다.
     *
     * 정리에 실패해도 세션 시작을 막지 않는다. 막으면 추적을 아예 쓸 수 없게 되는데,
     * 카메라가 남아 있는 경우의 증상은 pose가 안 잡히는 것이므로 warming-up으로 드러난다.
     */
    try {
      await startOptions.releaseCamera?.();
    } catch {
      // 카메라 정리 실패는 세션 시작을 막지 않는다.
    }

    const requestedAt = now();
    let opened: XRSession;

    try {
      opened = await xr.requestSession('immersive-ar', {
        optionalFeatures: optionalFeaturesFor(startOptions.domOverlayRoot),
        ...(startOptions.domOverlayRoot
          ? { domOverlay: { root: startOptions.domOverlayRoot } }
          : {}),
      });
    } catch {
      /**
       * 오류 name으로 원인을 판별하지 않는다. 실측에서 권한 거부가 NotAllowedError가 아니라
       * NotSupportedError로 나타났다(11.7). 대신 실패까지 걸린 시간을 본다.
       */
      const elapsedMs = now() - requestedAt;

      return setState({
        status: 'failed',
        reason: elapsedMs < PERMISSION_BLOCKED_MS ? 'permission-blocked' : 'request-rejected',
      });
    }

    /**
     * 권한 프롬프트를 기다리는 동안 화면을 벗어난 경우. reference space를 구하기 전에 닫는다.
     */
    if (stopRequested) {
      return abandon(opened);
    }

    /**
     * reference space보다 렌더 레이어를 먼저 붙인다.
     *
     * 레이어가 없으면 프레임이 오지 않아 reference space를 구해도 쓸 데가 없다. 순서를 뒤집으면
     * 레이어 실패 시 이미 구한 공간을 버리게 된다. 검증 페이지도 이 순서였다.
     */
    if (!(await (options.attachRenderLayer ?? attachRenderLayer)(opened))) {
      try {
        await opened.end();
      } catch {
        // 이미 끝났거나 종료에 실패해도 더 할 수 있는 일이 없다.
      }

      releaseRenderLayer();

      return setState({ status: 'failed', reason: 'no-render-layer' });
    }

    if (stopRequested) {
      return abandon(opened);
    }

    let acquired: XRReferenceSpace | null = null;
    let acquiredType: XRReferenceSpaceType | undefined;

    for (const type of REFERENCE_SPACE_CANDIDATES) {
      try {
        acquired = await opened.requestReferenceSpace(type);
        acquiredType = type;
        break;
      } catch {
        // 다음 후보를 시도한다.
      }
    }

    if (!acquired) {
      try {
        await opened.end();
      } catch {
        // 이미 끝났거나 종료에 실패해도 더 할 수 있는 일이 없다.
      }

      releaseRenderLayer();

      return setState({ status: 'failed', reason: 'no-reference-space' });
    }

    /**
     * reference space를 구하는 동안 화면을 벗어난 경우. 추적 루프를 걸지 않고 닫는다.
     */
    if (stopRequested) {
      return abandon(opened);
    }

    session = opened;
    sessionId = nextSessionId;
    nextSessionId += 1;
    referenceSpace = acquired;
    sampler = createPoseSampler(rule);
    lastPoseAt = null;
    latestReading = null;

    opened.addEventListener('end', onSessionEnd);
    detachUnloadListener = attachUnloadListener();
    frameHandle = opened.requestAnimationFrame(onFrame);

    /**
     * reference space까지 성공했으나 첫 pose는 아직 없다. 이 구간에 확정 위치를 만들지 않고
     * 직전 VPS 절대 좌표를 그대로 표시한다(11.4).
     */
    return setState({
      status: 'warming-up',
      reason: undefined,
      referenceSpaceType: acquiredType,
    });
  }

  async function stop(): Promise<void> {
    stopRequested = true;

    const attemptAtRequest = startAttempt;

    /**
     * 시작이 진행 중이면 그것이 끝나기를 기다린다. 세션 객체는 requestSession이 resolve된
     * 뒤에야 생기므로, 기다리지 않으면 닫을 대상이 없어 그냥 돌아가고 세션이 남는다.
     * run은 stopRequested를 보고 세션을 열자마자 닫으므로, 기다린 뒤에는 정리가 끝나 있다.
     */
    if (startInFlight) {
      await startInFlight.catch(() => undefined);
    }

    /**
     * 기다리는 동안 새 start가 시작된 경우. 그 세션은 이 stop이 끊으려던 대상이 아니다.
     */
    if (startAttempt !== attemptAtRequest) {
      return;
    }

    const current = session;

    if (!current) {
      return;
    }

    /**
     * end()가 'end' 이벤트를 발생시키고 onSessionEnd가 정리한다. 이벤트가 오지 않는 경우에도
     * 자원이 남지 않도록 여기서 한 번 더 정리한다. teardown은 여러 번 불려도 안전하다.
     */
    try {
      await current.end();
    } catch {
      // 이미 끝난 세션이면 무시한다.
    }

    teardown();
    setState({ status: 'ended', reason: undefined });
  }

  return {
    getState() {
      return state;
    },

    getSessionId() {
      return sessionId;
    },

    subscribe(listener) {
      stateListeners.add(listener);

      return () => {
        stateListeners.delete(listener);
      };
    },

    getLatestReading() {
      return latestReading;
    },

    subscribeSnapshots(listener) {
      snapshotListeners.add(listener);

      return () => {
        snapshotListeners.delete(listener);
      };
    },

    start(startOptions = {}) {
      /**
       * 중복 세션 방지.
       *
       * 진행 중인 요청이 있으면 그 Promise를 공유한다. 이미 열려 있으면 현재 상태를 그대로
       * 돌려준다. status만으로는 같은 tick 안의 연속 호출을 막지 못해 참조를 함께 본다.
       */
      if (startInFlight) {
        return startInFlight;
      }

      if (session) {
        return Promise.resolve(state);
      }

      startInFlight = run(startOptions).finally(() => {
        startInFlight = null;
      });

      return startInFlight;
    },

    stop,
  };
}

/**
 * 앱 전체가 공유하는 컨트롤러.
 *
 * XR 세션은 한 번에 하나만 열 수 있으므로 인스턴스도 하나여야 한다. 화면은 이 객체를 통해
 * 상태와 스냅샷만 구독하고 세션 객체 자체는 보지 않는다.
 */
export const xrSessionController = createXrSessionController();
