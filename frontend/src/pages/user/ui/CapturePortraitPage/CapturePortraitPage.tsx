import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { queueCurrentNodeSync, useUserSessionStore } from '@/entities/user-session';
import { ConsultCta } from '@/features/consult-request';
import {
  appendLocalizationCandidate,
  selectWeightedLocalization,
} from '@/features/location-weighted-vote';
import { readForwardMap } from '@/features/xr-tracking';
import { localize, type LocalizationCandidateResponse } from '@/shared/api';
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

const DIRECTION_KEYS = [
  {
    key: 'left',
    arrow: '←',
  },
  {
    key: 'front',
    arrow: '↑',
  },
  {
    key: 'right',
    arrow: '→',
  },
] as const;

/**
 * Camera capture and VPS matching happen together on this screen.
 *
 * Samples camera frames until the 15-second deadline and navigates to
 * Strong results navigate immediately. Weak pose candidates are clustered across frames and
 * navigate only after their confidence-weighted votes agree.
 */
export function CapturePortraitPage() {
  const { t } = useTranslation();
  const directions = DIRECTION_KEYS.map((item) => ({
    ...item,
    label: t(`user.capture.${item.key}.label`),
    instruction: t(`user.capture.${item.key}.instruction`),
    cameraHint: t(`user.capture.${item.key}.hint`),
  }));
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
  const candidateVotes = useRef<LocalizationCandidateResponse[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [timeoutOpen, setTimeoutOpen] = useState(false);
  const [currentDirection, setCurrentDirection] = useState(1);
  const direction = directions[currentDirection];
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
        if (disposed) return;
        let confirmed: LocalizationCandidateResponse | null = null;
        let confidenceScore: number | null = null;
        if (
          result.resultStatus === 'success' &&
          result.startNodeId != null &&
          result.position?.floorId != null &&
          result.position.floorCode != null &&
          result.position.mapX != null &&
          result.position.mapY != null
        ) {
          confirmed = {
            position: {
              ...result.position,
              floorId: result.position.floorId,
              floorCode: result.position.floorCode,
              mapX: result.position.mapX,
              mapY: result.position.mapY,
            },
            startNodeId: result.startNodeId,
            startNodeLabel: result.startNodeLabel,
            startNodeLabelEn: result.startNodeLabelEn,
            // 가중 투표 타입에는 점수가 필수다. 구버전 서버 응답은 강한 단일 프레임으로 취급하되,
            // 화면에 표시할 값은 아래 confidenceScore를 null로 유지해 가짜 100%를 만들지 않는다.
            confidenceScore: result.confidenceScore ?? 1,
          };
          confidenceScore = result.confidenceScore ?? null;
        } else if (result.resultStatus === 'low_confidence' && result.candidate) {
          candidateVotes.current = appendLocalizationCandidate(
            candidateVotes.current,
            result.candidate,
          );
          confirmed = selectWeightedLocalization(candidateVotes.current);
          confidenceScore = confirmed?.confidenceScore ?? null;
        }

        if (confirmed) {
          localized = true;
          timedOutRef.current = false;
          setTimeoutOpen(false);
          const position = confirmed.position;
          setCurrentLocation({
            nodeId: confirmed.startNodeId,
            floorId: position.floorId,
            label: confirmed.startNodeLabel ?? undefined,
            labelEn: confirmed.startNodeLabelEn ?? undefined,
            mapX: position.mapX,
            mapY: position.mapY,
            forwardMap: readForwardMap(position),
            confidenceScore,
            accuracyM: position.accuracyM ?? null,
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
          queueCurrentNodeSync(confirmed.startNodeId);
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
      setCurrentDirection((value) => (value + 1) % DIRECTION_KEYS.length);
    }, 2500);

    return () => window.clearTimeout(guideTimer);
  }, [currentDirection, noticeOpen]);

  const retryCapture = () => {
    timedOutRef.current = false;
    candidateVotes.current = [];
    setTimeoutOpen(false);
    setElapsed(0);
    setCurrentDirection(1);
    setAttempt((value) => value + 1);
  };

  return (
    <PhoneFrame
      layout="flush"
      bodyClassName={styles.body}
      overlay={
        noticeOpen ? (
          <Sheet placement="center" label={t('user.capture.notFound')}>
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
            <h2 className={styles.timeoutTitle}>{t('user.capture.notFoundYet')}</h2>
            <p className={styles.timeoutDescription}>{t('user.capture.notFoundDescription')}</p>
            <div className={styles.timeoutActions}>
              <Button variant="secondary" onClick={retryCapture}>
                <Icon name="refresh" size={17} />
                {t('user.capture.retry')}
              </Button>
              <ConsultCta label={t('user.capture.consult')} className={styles.timeoutAction} />
            </div>
          </Sheet>
        ) : undefined
      }
    >
      <>
        <div className={styles.topBar}>
          <ViewfinderBack to={USER_ROUTES.CAPTURE_GUIDE} />
          <RecordingBadge label={t('user.capture.remaining', { seconds: remaining })} />
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
            {t('user.capture.matching')}
          </div>
        </div>

        <div className={styles.dock}>
          <div className={styles.guideHead}>
            <span className={styles.guideIcon}>
              <Icon name="camera" size={18} />
            </span>
            <div>
              <strong className={styles.guideTitle}>{t('user.capture.guideTitle')}</strong>
              <p className={styles.guideText}>{t('user.capture.guideDescription')}</p>
            </div>
          </div>

          <div className={styles.motionGuide} aria-label={t('user.capture.directionGuide')}>
            {directions.map((item, index) => {
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
              <span>{t('user.capture.progress')}</span>
              <strong>{t('user.capture.seconds', { seconds: remaining })}</strong>
            </div>
            <div
              className={styles.timerTrack}
              role="progressbar"
              aria-label={t('user.capture.progressLabel')}
              aria-valuemin={0}
              aria-valuemax={CAPTURE_SECONDS}
              aria-valuenow={elapsed}
            >
              <span style={{ width: `${(elapsed / CAPTURE_SECONDS) * 100}%` }} />
            </div>
          </div>

          <p className={styles.safetyNote}>
            <Icon name="info" size={13} />
            {t('user.capture.safety')}
          </p>
        </div>
      </>
    </PhoneFrame>
  );
}
