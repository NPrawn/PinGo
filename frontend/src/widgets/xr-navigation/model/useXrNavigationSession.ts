import { useCallback, useEffect, useRef, useState } from 'react';
import type { IndoorPoint } from '@/entities/navigation';
import { useXrMapPosition, type PlanarVector, type UseXrMapPositionValue } from '@/features/xr-tracking';
import {
  detectXrSupport,
  xrSessionController,
  type XrSessionController,
  type XrStartOptions,
  type XrSupport,
} from '@/shared/lib/webxr';

/**
 * 세션 게이트의 단계.
 *
 * - notice: 세션을 열기 전 안내를 보여주는 중이다. **진입 시 기본값이다.**
 * - session: 사용자가 확인을 눌러 세션을 열었다(실패했을 수도 있다).
 * - without-tracking: 사용자가 추적 없이 안내를 계속하기로 했다.
 */
type GatePhase = 'notice' | 'session' | 'without-tracking';

export interface UseXrNavigationSessionOptions {
  /**
   * 안내 화면 진입 시점의 확정 실내 위치.
   *
   * 앵커가 생긴 뒤 이 값을 바꾸면 표시에 반영되지 않는다. 296 훅의 계약이며 근거는
   * `UseXrMapPositionOptions.currentIndoorLocation` 주석에 있다.
   */
  currentIndoorLocation?: IndoorPoint | null;
  /** Actual VPS direction paired with the confirmed indoor location. */
  anchorForwardMap?: PlanarVector | null;
  /** Map-coordinate units per physical XR meter. */
  distanceScale?: number;
  /** 테스트에서 가짜 컨트롤러를 주입한다. */
  controller?: XrSessionController;
  /**
   * 세션을 열기 직전에 앱의 카메라 스트림을 반납하는 함수. (11.8)
   *
   * **호출부가 넘긴다.** 카메라 미리보기는 다른 위젯이 소유하고, 이 저장소는 같은 레이어끼리
   * import하지 않는다. 화면이 두 위젯을 모두 알고 있으므로 연결도 화면이 한다.
   *
   * 넘기지 않으면 정리가 일어나지 않는다. 미리보기를 켠 채 세션을 열면 세션은 오류 없이 열리고
   * pose만 영원히 들어오지 않는다.
   */
  releaseCamera?: () => void | Promise<void>;
}

export interface UseXrNavigationSessionValue extends UseXrMapPositionValue {
  /**
   * dom-overlay root가 될 요소에 붙인다.
   *
   * **세션을 열기 전에 DOM에 있어야 한다.** root는 세션을 열 때 한 번 정해지고 도중에
   * 바꿀 수 없다(`XrStartOptions.domOverlayRoot`).
   */
  overlayRef: React.RefObject<HTMLDivElement | null>;
  /**
   * 세션 전 안내를 표시할지.
   *
   * 진입 시 참이고, 세션 시작이 실패하면 다시 참이 된다. 11.7이 "세션을 자동으로 열지 않고
   * 안내 후 사용자가 확인을 누르면 연다"로 확정했고, 동의 상태를 미리 조회할 수 없으므로
   * **상태와 무관하게 항상 표시한다.**
   */
  isNoticeOpen: boolean;
  /**
   * `immersive-ar` 지원 여부. 탐지가 끝나기 전에는 null이다.
   *
   * 미지원이면 안내에 재시도 수단을 두지 않는다(11.7). `permissions.query`는 쓰지 않는다 —
   * Chrome 150에서 인자 변환 단계에 동기 throw가 나고, 어차피 동의 상태를 알려주지 않는다.
   */
  support: XrSupport | null;
  /** 사용자가 안내를 확인했다. 여기서 세션을 연다. */
  confirm: () => void;
  /** 추적 없이 안내를 계속한다. 세션을 열지 않는다(11.7의 fallback 경로). */
  continueWithoutTracking: () => void;
  /**
   * XR 세션이 살아 있는지. **카메라 영상이 화면에 그려지는 구간과 같다.**
   *
   * 상단 영역을 투명하게 둘지 판단하는 데 쓴다. `starting`은 포함하지 않는다 — 그 구간에는
   * 아직 컴포지터가 카메라를 그리지 않으므로, 투명하게 두면 검은 화면이 보인다.
   */
  isSessionOpen: boolean;
}

/**
 * 경로 안내 화면의 XR 세션 게이트. (S15P11A206-141)
 *
 * 296의 `useXrMapPosition`을 그대로 쓰고, 그 위에 **세션을 언제 여는지**만 얹는다.
 * pose 수집·좌표 변환·확정 주기·표시 평활은 295·296이 끝냈으므로 손대지 않는다.
 *
 * 순서가 11.7의 확정 사항이다.
 *
 * ```
 * 진입 → 앱 안내 표시 → 사용자 확인 → requestSession → 시스템 프롬프트 2회 → 세션
 *                     └ 나중에 → 추적 없이 안내 계속 (지도만)
 * ```
 *
 * 자동으로 열지 않는 이유는 거부가 영구적이기 때문이다. 한 번 거부하면 이후
 * `requestSession`은 프롬프트 없이 즉시 실패하고 앱 안에서 되돌릴 수 없다(11.7).
 */
export function useXrNavigationSession({
  currentIndoorLocation = null,
  anchorForwardMap = null,
  distanceScale = 1,
  controller = xrSessionController,
  releaseCamera,
}: UseXrNavigationSessionOptions = {}): UseXrNavigationSessionValue {
  const tracking = useXrMapPosition({ currentIndoorLocation, distanceScale, controller });

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<GatePhase>('notice');
  const [support, setSupport] = useState<XrSupport | null>(null);

  /**
   * 지원 탐지는 마운트 시 한 번 한다. 세션을 열지 않으므로 프롬프트가 뜨지 않는다.
   *
   * 언마운트 후 상태를 갱신하지 않도록 취소 표시를 둔다. `isSessionSupported`는 실측에서
   * 즉시 반환했지만 기기에 따라 늦을 수 있다.
   */
  useEffect(() => {
    let cancelled = false;

    void detectXrSupport().then((result) => {
      if (!cancelled) setSupport(result);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const { start } = tracking;

  const confirm = useCallback(() => {
    setPhase('session');

    const options: XrStartOptions = {};
    const root = overlayRef.current;

    /**
     * root가 없으면 dom-overlay 없이 연다.
     *
     * 컨트롤러가 root 유무로 `optionalFeatures`를 가른다 — 없이 요청하면 어차피 부여되지
     * 않으면서 동의 프롬프트만 하나 더 뜬다(11.7).
     */
    if (root) options.domOverlayRoot = root;
    /**
     * 앞 화면들이 켜 둔 카메라를 반납한다. (11.8)
     *
     * 촬영·위치 확인·경로 선택이 모두 후면 카메라 미리보기를 쓴다. 그 스트림이 살아 있는 채로
     * 세션을 열면 세션·reference space·dom-overlay가 모두 성공하는데 pose만 들어오지 않는다.
     * 컨트롤러가 `requestSession` 직전에 이 함수를 await한다.
     */
    if (releaseCamera) options.releaseCamera = releaseCamera;

    void start(options);
  }, [start, releaseCamera]);

  const continueWithoutTracking = useCallback(() => {
    setPhase('without-tracking');
  }, []);

  const { isTracking, setAnchor, clearAnchor, status } = tracking;

  /** 이 세션에서 첫 위치 인식을 이미 발화했는지. 세션이 다시 열리면 되돌린다. */
  const anchorFiredRef = useRef(false);

  /**
   * 세션이 새로 열리면 옛 앵커를 버리고 발화를 다시 연다.
   *
   * **앵커는 세션의 reference space 원점을 기준으로 한다.** 세션이 다시 열리면 그 원점이 새로
   * 잡히므로, 옛 앵커로 새 세션의 pose를 변환하면 오류 없이 조용히 틀린 위치가 나온다. 새 앵커를
   * 만들기 전에 도착한 첫 스냅샷이 이미 옛 앵커로 변환되므로 발화를 여는 것만으로는 부족하고
   * 앵커 자체를 버려야 한다.
   *
   * **추적 상실(`lost`)로는 초기화하지 않는다.** 상실 임계값이 1500ms인데 실측에서 평지·계단
   * 보행 중에도 약 1초씩 pose가 끊긴다. 즉 정상 보행에서 `lost`가 발생한다. 그때 앵커를 다시
   * 만들면 좌표가 진입 시점 확정 위치로 되돌아가 걸어온 거리가 사라진다. 세션이 살아 있는 동안
   * XR 원점은 그대로이므로 기존 앵커가 여전히 유효하다.
   *
   * 세션이 끝나 식별자가 `null`이 되는 것으로도 초기화하지 않는다. 그 구간에는 마지막 유효
   * 위치를 그대로 보여주는 것이 11.7의 처리이며, 앵커를 버리면 마커가 진입 위치로 되돌아간다.
   */
  const sessionIdRef = useRef<number | null>(null);

  useEffect(() => {
    const sessionId = controller.getSessionId();

    if (sessionId === null || sessionId === sessionIdRef.current) return;

    sessionIdRef.current = sessionId;
    anchorFiredRef.current = false;
    clearAnchor();
  }, [controller, clearAnchor, status]);

  /**
   * 첫 위치 인식 발화. 추적이 잡히는 순간 한 번만 앵커를 만든다.
   *
   * **발화 시점을 `isTracking`으로 잡는 이유.** 세션 시작 직후 0.96~1.54초는 warming-up이고
   * pose가 없다. 그 구간에 부르면 `setAnchor`가 컨트롤러의 `getLatestReading`에서 null을 받아
   * 실패한다. 보류했다가 나중에 적용하는 대기 큐는 만들지 않는다 — 앵커는 지도 좌표와 pose를
   * **같은 순간의 값으로** 묶어야 하는데, 큐는 그 둘의 시점을 어긋나게 한다.
   *
   * 진입 전 VPS 응답의 실제 `forwardMap`만 사용한다. 방향이 없으면 회전을 추정하지 않고
   * 앵커를 만들지 않는다. 임의 방향을 사용하면 지도 경로를 가로지르는 오차가 생기기 때문이다.
   */
  useEffect(() => {
    if (
      !isTracking ||
      anchorFiredRef.current ||
      !currentIndoorLocation ||
      !anchorForwardMap
    ) {
      return;
    }

    // 실패하면 다시 시도할 수 있게 표시를 남기지 않는다. 성공한 뒤에만 발화를 닫는다.
    anchorFiredRef.current = setAnchor(currentIndoorLocation, anchorForwardMap);
  }, [anchorForwardMap, isTracking, currentIndoorLocation, setAnchor]);

  /**
   * 세션 시작이 실패하면 안내를 다시 띄운다.
   *
   * 실패 사유별 문구와 재시도 가능 여부는 안내 컴포넌트가 `support`·`reason`·`canRetry`로
   * 판단한다. 별도 상태를 두지 않고 `phase`와 추적 상태에서 유도하므로, 재시도 후 성공하면
   * 안내가 저절로 닫힌다.
   */
  const isNoticeOpen = phase === 'notice' || (phase === 'session' && tracking.status === 'failed');

  /**
   * 컴포지터가 카메라를 그리고 있는 상태만 참으로 둔다.
   *
   * `lost`도 포함한다 — 추적이 끊겨도 세션은 열려 있고 카메라 영상은 계속 나온다. 그 구간에
   * 배경을 되돌리면 화면이 깜빡인다. 위치 갱신이 멈춘 것은 배지가 알린다(11.7).
   */
  const isSessionOpen =
    tracking.status === 'warming-up' ||
    tracking.status === 'tracking' ||
    tracking.status === 'lost';

  return {
    ...tracking,
    overlayRef,
    isNoticeOpen,
    support,
    confirm,
    continueWithoutTracking,
    isSessionOpen,
  };
}
