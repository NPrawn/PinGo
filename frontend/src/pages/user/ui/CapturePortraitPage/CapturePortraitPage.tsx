import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import { ConsultCta } from '@/features/consult-request';
import { getStationMaps, localize, updateUserSession } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { Blob, BlobHero, Button, Icon, Sheet } from '@/shared/ui';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureInFlight = useRef(false);
  const timedOutRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [timeoutOpen, setTimeoutOpen] = useState(false);
  const [currentDirection, setCurrentDirection] = useState(1);
  const direction = DIRECTIONS[currentDirection];
  const remaining = Math.max(CAPTURE_SECONDS - elapsed, 0);

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

      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        scheduleNextCapture();
        return;
      }

      captureInFlight.current = true;
      let localized = false;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.86),
        );
        if (!blob) throw new Error('Camera frame encoding failed');

        const maps = await getStationMaps(stationId);
        const mapVersion = maps.find((map) => map.version)?.version;
        if (!mapVersion) throw new Error('VPS map is not ready');

        const result = await localize(new File([blob], 'capture.jpg', { type: 'image/jpeg' }), {
          userSessionId,
          stationId,
          mapVersion,
          capturedAt: new Date().toISOString(),
          camera: {
            model: 'PINHOLE',
            width: canvas.width,
            height: canvas.height,
            intrinsicsSource: 'browser',
          },
        });
        // 앵커링에 성공하면 서버가 경로 시작 노드와 캐노니컬 좌표를 함께 준다.
        // 좌표 정합이 없는 층(역삼역 B1)은 status가 map_not_ready로 내려온다. (S15P11A206-128)
        const position = result.position;

        if (disposed || timedOutRef.current) return;
        if (
          result.resultStatus === 'success' &&
          result.startNodeId != null &&
          position?.floorId != null
        ) {
          localized = true;
          setCurrentLocation({
            nodeId: result.startNodeId,
            floorId: position.floorId,
            label: result.startNodeLabel ?? undefined,
            mapX: position.mapX,
            mapY: position.mapY,
          });
          const floorCode = maps.find((map) => map.floorId === position.floorId)?.floorCode;
          if (
            floorCode === '1F' ||
            floorCode === 'B1' ||
            floorCode === 'B2' ||
            floorCode === 'B3'
          ) {
            setFloor(floorCode);
          }
          await updateUserSession(userSessionId, { currentNodeId: result.startNodeId });
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

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scheduleNextCapture();
        }
      } catch {
        if (!disposed) {
          timedOutRef.current = true;
          setTimeoutOpen(true);
        }
      }
    }

    void startCamera();
    return () => {
      disposed = true;
      if (captureTimer) window.clearTimeout(captureTimer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [attempt, navigate, setCurrentLocation, setFloor, stationId, userSessionId]);

  useEffect(() => {
    timedOutRef.current = false;

    const timer = window.setInterval(() => {
      setElapsed((value) => {
        const next = value + 1;

        if (next >= CAPTURE_SECONDS) {
          window.clearInterval(timer);
          timedOutRef.current = true;
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
          setTimeoutOpen(true);
          return CAPTURE_SECONDS;
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (timeoutOpen) return;

    const guideTimer = window.setTimeout(() => {
      setCurrentDirection((value) => (value + 1) % DIRECTIONS.length);
    }, 2500);

    return () => window.clearTimeout(guideTimer);
  }, [currentDirection, timeoutOpen]);

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
        timeoutOpen ? (
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
          <video ref={videoRef} className={styles.cameraVideo} muted playsInline aria-hidden />
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
            <rect x="129" y="172.8" width="42" height="51.2" rx="3" fill="rgba(127,239,195,0.2)" />
            <path
              d="M0 512 H90 M210 512 H300"
              stroke="rgba(127,239,195,0.12)"
              strokeWidth="1"
              fill="none"
            />
          </svg>

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
