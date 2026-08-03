import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { queueCurrentNodeSync, useUserSessionStore } from '@/entities/user-session';
import { ConsultCta } from '@/features/consult-request';
import { localize } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { Blob, BlobHero, Button, Icon, Sheet } from '@/shared/ui';
import {
  CameraFallbackNotice,
  CameraFeed,
  useCameraPreview,
  vpsFrameDimensions,
} from '@/widgets/camera-preview';
import { RecordingBadge, ViewfinderBack } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './CapturePortraitPage.module.css';

const CAPTURE_SECONDS = 15;
const CAPTURE_RETRY_DELAY_MS = 1200;

const DIRECTIONS = [
  {
    label: '왼쪽',
    instruction: '몸을 왼쪽으로 천천히 돌려주세요',
    cameraHint: '왼쪽 표지판과 기둥이 보이게 비춰주세요',
    arrow: '←',
  },
  {
    label: '정면',
    instruction: '다시 정면을 바라봐 주세요',
    cameraHint: '정면을 향한 채 잠시 멈춰주세요',
    arrow: '↑',
  },
  {
    label: '오른쪽',
    instruction: '이제 오른쪽을 천천히 비춰주세요',
    cameraHint: '오른쪽 통로가 충분히 보이게 담아주세요',
    arrow: '→',
  },
] as const;

/**
 * Camera capture and VPS matching happen together on this screen.
 *
 * Samples camera frames until the 15-second deadline and navigates to
 * `LOCATE_SUCCESS` as soon as one VPS matching response succeeds.
 */
export function CapturePortraitPage() {
  const navigate = useNavigate();
  const stationId = useStationStore((state) => state.stationId);
  const setFloor = useStationStore((state) => state.setFloor);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const setCurrentLocation = useNavigationStore((state) => state.setCurrentLocation);
  /**
   * 카메라는 위젯이 소유한다. 이 화면은 프레임만 떠 간다.
   *
   * 촬영 흐름의 여러 화면이 같은 스트림을 이어 쓰고 XR 진입 때 한 곳에서 끊어야 하므로,
   * 화면이 직접 `getUserMedia`를 부르지 않는다(11.8).
   */
  const camera = useCameraPreview();
  const captureInFlight = useRef(false);
  const timedOutRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [timeoutOpen, setTimeoutOpen] = useState(false);
  const [currentDirection, setCurrentDirection] = useState(1);
  const direction = DIRECTIONS[currentDirection];
  const remaining = Math.max(CAPTURE_SECONDS - elapsed, 0);
  /**
   * 카메라를 켤 수 없는 상태. 거부·미지원·실패를 함께 다룬다.
   *
   * 어느 쪽이든 뜰 프레임이 없어 15초를 기다릴 이유가 없다. 곧바로 재시도·상담 안내를 띄운다.
   */
  const cameraBlocked =
    camera.status === 'denied' || camera.status === 'unsupported' || camera.status === 'error';

  useEffect(() => {
    let disposed = false;
    let captureTimer: number | undefined;

    function scheduleNextCapture(delay = CAPTURE_RETRY_DELAY_MS) {
      if (disposed || timedOutRef.current) return;
      captureTimer = window.setTimeout(() => void captureAndLocalize(), delay);
    }

    async function captureAndLocalize() {
      // 등록되지 않은 역은 VPS 맵도 없다. 촬영해도 물어볼 곳이 없다.
      if (disposed || timedOutRef.current || !userSessionId || stationId == null) return;
      if (captureInFlight.current) {
        scheduleNextCapture();
        return;
      }

      const video = camera.videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        scheduleNextCapture();
        return;
      }
      // 위치추정은 카메라가 실제로 본 화면과 내부 파라미터가 맞아야 한다. 화면을 자르지
      // 않고 긴 변만 768px로 축소하며, 메타데이터도 전송 프레임 크기에 맞춘다.
      const frame = vpsFrameDimensions(video.videoWidth, video.videoHeight);
      const frameWidth = frame.width;
      const frameHeight = frame.height;

      captureInFlight.current = true;
      let localized = false;
      try {
        const blob = await camera.capture();
        if (!blob) throw new Error('Camera frame encoding failed');

        const result = await localize(new File([blob], 'capture.jpg', { type: 'image/jpeg' }), {
          userSessionId,
          stationId,
          capturedAt: new Date().toISOString(),
          camera: {
            model: 'PINHOLE',
            width: frameWidth,
            height: frameHeight,
            intrinsicsSource: 'browser',
          },
        });
        // 앵커링에 성공하면 서버가 경로 시작 노드와 캐노니컬 좌표를 함께 준다.
        // 좌표 정합이 없는 층(역삼역 B1)은 status가 map_not_ready로 내려온다. (S15P11A206-128)
        const position = result.position;

        if (disposed) return;
        if (
          result.resultStatus === 'success' &&
          result.startNodeId != null &&
          position?.floorId != null
        ) {
          localized = true;
          timedOutRef.current = false;
          setTimeoutOpen(false);
          setCurrentLocation({
            nodeId: result.startNodeId,
            floorId: position.floorId,
            label: result.startNodeLabel ?? undefined,
            mapX: position.mapX,
            mapY: position.mapY,
          });
          const floorCode = position.floorCode;
          if (
            floorCode === '1F' ||
            floorCode === 'B1' ||
            floorCode === 'B2' ||
            floorCode === 'B3'
          ) {
            setFloor(floorCode);
          }
          queueCurrentNodeSync(result.startNodeId);
          navigate(USER_ROUTES.LOCATE_SUCCESS, { replace: true });
          return;
        }
      } catch {
        // A single frame can fail while the user is still turning the camera.
        // Keep sampling until the shared 15-second deadline expires.
      } finally {
        captureInFlight.current = false;
        if (!localized) scheduleNextCapture();
      }
    }

    /**
     * 카메라가 켜질 때까지 기다렸다가 촬영을 시작한다.
     *
     * 위젯이 스트림을 잡는 동안에는 `videoWidth`가 0이라 뜰 프레임이 없다. 위의
     * `captureAndLocalize`가 그 경우 스스로 다시 예약하므로 곧바로 걸어도 된다.
     *
     * 카메라를 아예 켤 수 없으면 촬영을 걸지 않는다. 안내는 `cameraBlocked`가 화면에서
     * 바로 띄우므로 여기서 상태를 건드리지 않는다.
     */
    if (cameraBlocked) {
      timedOutRef.current = true;
    } else {
      scheduleNextCapture(0);
    }

    return () => {
      disposed = true;
      if (captureTimer) window.clearTimeout(captureTimer);
    };
  }, [
    attempt,
    camera,
    cameraBlocked,
    navigate,
    setCurrentLocation,
    setFloor,
    stationId,
    userSessionId,
  ]);

  useEffect(() => {
    timedOutRef.current = false;

    const timer = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 1;

        if (next >= CAPTURE_SECONDS) {
          window.clearInterval(timer);
          timedOutRef.current = true;
          setTimeoutOpen(true);
          return CAPTURE_SECONDS;
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [attempt]);

  /** 안내 시트가 떠 있으면 촬영 방향 안내를 돌리지 않는다. */
  const noticeOpen = timeoutOpen || cameraBlocked;

  useEffect(() => {
    if (noticeOpen) return;

    const guideTimer = window.setTimeout(() => {
      setCurrentDirection((value) => (value + 1) % DIRECTIONS.length);
    }, 2500);

    return () => window.clearTimeout(guideTimer);
  }, [currentDirection, noticeOpen]);

  const retryCapture = () => {
    timedOutRef.current = false;
    setTimeoutOpen(false);
    setElapsed(0);
    setCurrentDirection(1);
    setAttempt((value) => value + 1);
  };

  return (
    <PhoneFrame
      layout="flush"
      bodyClassName={styles.body}
      statusBarClassName={styles.statusBar}
      overlay={
        noticeOpen ? (
          <Sheet placement="center" label="현재 위치를 찾지 못했어요">
            <BlobHero className={styles.timeoutHero}>
              <Blob tone="coral" slot="main" style={{ width: 76, height: 76 }} />
              <Blob
                tone="lilac"
                slot="a"
                style={{ top: '6%', right: '26%', width: 26, height: 26 }}
              />
              <Blob
                tone="sky"
                slot="c"
                style={{ bottom: '10%', left: '26%', width: 20, height: 20 }}
              />
              <div className={styles.timeoutHeroIcon}>
                <Icon name="warning" size={30} />
              </div>
            </BlobHero>
            <h2 className={styles.timeoutTitle}>아직 현재 위치를 찾지 못했어요</h2>
            <p className={styles.timeoutDescription}>
              주변과 위치가 매칭되지 않았어요.
              <br />
              다시 촬영하거나 상담을 요청해 주세요.
            </p>
            <div className={styles.timeoutActions}>
              <Button variant="secondary" onClick={retryCapture}>
                <Icon name="refresh" size={17} />
                다시 촬영하기
              </Button>
              <ConsultCta label="상담 연결" className={styles.timeoutAction} />
            </div>
          </Sheet>
        ) : undefined
      }
    >
      <>
        <div className={styles.topBar}>
          <ViewfinderBack to={USER_ROUTES.CAPTURE_GUIDE} />
          <RecordingBadge label={`LIVE · ${remaining}초 남음`} />
          <ConsultCta variant="icon" />
        </div>

        <div className={styles.viewfinder}>
          <CameraFeed camera={camera} className={styles.feed} />

          {/* 카메라를 켤 수 없을 때의 대체 그림. 검은 화면으로 두지 않는다. */}
          {!camera.isLive && (
            <svg
              viewBox="0 0 300 640"
              preserveAspectRatio="none"
              className={styles.scene}
              aria-hidden
            >
              <path d="M0 640 L117 320 H183 L300 640 Z" fill="rgba(60,216,160,0.07)" />
              <path
                d="M0 640 L117 320 M300 640 L183 320 M117 320 H183"
                stroke="rgba(127,239,195,0.24)"
                strokeWidth="1.2"
                fill="none"
              />
              <path
                d="M117 320 V128 H183 V320"
                stroke="rgba(127,239,195,0.16)"
                strokeWidth="1.2"
                fill="none"
              />
              <rect
                x="129"
                y="172.8"
                width="42"
                height="51.2"
                rx="3"
                fill="rgba(127,239,195,0.2)"
              />
              <path
                d="M0 512 H90 M210 512 H300"
                stroke="rgba(127,239,195,0.12)"
                strokeWidth="1"
                fill="none"
              />
            </svg>
          )}

          <CameraFallbackNotice status={camera.status} />

          <div className={styles.band} aria-hidden />
          <div className={styles.horizon} aria-hidden />
          <div className={styles.cornerLeft} aria-hidden />
          <div className={styles.cornerRight} aria-hidden />

          <div className={styles.directionOverlay}>
            <span className={styles.directionArrow} aria-hidden>
              {direction.arrow}
            </span>
            <strong>{direction.cameraHint}</strong>
          </div>

          <div className={styles.matchingBadge}>
            <span className={styles.matchingSpinner} aria-hidden />
            촬영과 동시에 현재 위치를 찾고 있어요
          </div>
        </div>

        <div className={styles.dock}>
          <div className={styles.guideHead}>
            <span className={styles.guideIcon}>
              <Icon name="camera" size={18} />
            </span>
            <div>
              <strong className={styles.guideTitle}>세 방향을 자유롭게 비춰주세요</strong>
              <p className={styles.guideText}>
                발은 움직이지 않고 왼쪽·정면·오른쪽을 천천히 오가며 촬영해 주세요.
              </p>
            </div>
          </div>

          <div className={styles.motionGuide} aria-label="촬영 방향 가이드">
            {DIRECTIONS.map((item, index) => {
              return (
                <button
                  key={item.label}
                  type="button"
                  className={styles.motionStep}
                  aria-pressed={index === currentDirection}
                  onClick={() => setCurrentDirection(index)}
                >
                  <span
                    className={[
                      styles.motionPoint,
                      index === currentDirection && styles.motionPointCurrent,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {item.arrow}
                  </span>
                  <span className={styles.motionLabel}>{item.label}</span>
                </button>
              );
            })}
            <p className={styles.motionHint}>{direction.instruction}</p>
          </div>

          <div className={styles.timerRow}>
            <div className={styles.timerText}>
              <span>주변 촬영 및 위치 매칭</span>
              <strong>{remaining}초</strong>
            </div>
            <div
              className={styles.timerTrack}
              role="progressbar"
              aria-label="촬영 및 위치 매칭 진행률"
              aria-valuemin={0}
              aria-valuemax={CAPTURE_SECONDS}
              aria-valuenow={elapsed}
            >
              <span style={{ width: `${(elapsed / CAPTURE_SECONDS) * 100}%` }} />
            </div>
          </div>

          <p className={styles.safetyNote}>
            <Icon name="info" size={13} />
            주변 사람과 장애물을 확인하며 천천히 움직여 주세요.
          </p>
        </div>
      </>
    </PhoneFrame>
  );
}
