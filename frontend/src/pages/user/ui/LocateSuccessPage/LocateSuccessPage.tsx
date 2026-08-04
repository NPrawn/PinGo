import { useTranslation } from 'react-i18next';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { localizeUserLabel } from '@/shared/lib/localizeUserLabel';
import { ButtonLink, Card, GhostLink, Icon, Icon3d } from '@/shared/ui';
import { CameraFallbackNotice, CameraFeed, useCameraPreview } from '@/widgets/camera-preview';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './LocateSuccessPage.module.css';

/** Keep the live camera visible while the user confirms the matched position. */
export function LocateSuccessPage() {
  const { t, i18n } = useTranslation();
  const station = useStationStore((state) => state.station);
  const floor = useStationStore((state) => state.floor);
  /** 위치 인식이 준 경로 시작 노드의 이름. 역·층 표기보다 구체적이다. */
  const currentLocationLabel = useNavigationStore((state) => state.currentLocationLabel);
  const locationText = localizeUserLabel(
    currentLocationLabel ?? `${station} · ${floor}`,
    i18n.resolvedLanguage === 'en' ? 'en' : 'ko',
  );
  /** 안내 중 재인식으로 왔는지. 돌아갈 화면을 가른다. (S15P11A206-141) */
  const relocalizing = useNavigationStore((state) => state.relocalizing);
  const camera = useCameraPreview();

  return (
    <PhoneFrame layout="flush" bodyClassName={styles.body}>
      <>
        <section className={styles.camera} aria-label={t('user.locateSuccess.camera')}>
          <div className={styles.topBar}>
            <ViewfinderBack to={USER_ROUTES.CAPTURE_PORTRAIT} />
            <ConsultCta variant="icon" />
          </div>

          <CameraFeed camera={camera} className={styles.feed} />

          {/*
            카메라를 켤 수 없을 때 쓰는 대체 그림. 권한 거부, 보안 컨텍스트가 아닌 접속
            (`http://` LAN 주소), 카메라가 없는 기기에서 이쪽이 보인다. 검은 화면을 두면
            사용자는 앱이 멈춘 것으로 읽는다.
          */}
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
            </svg>
          )}

          <CameraFallbackNotice status={camera.status} />

          <div className={styles.horizon} aria-hidden />
          <div className={styles.cornerLeft} aria-hidden />
          <div className={styles.cornerRight} aria-hidden />

          <div className={styles.cameraResult}>
            <span className={styles.cameraCheck}>
              <Icon name="check" size={22} />
            </span>
            <strong>{t('user.locateSuccess.found')}</strong>
            <span>{locationText}</span>
          </div>

          <div className={styles.cameraMeta}>
            <span>
              <span className={styles.confidenceDot} aria-hidden />
              {t('user.locateSuccess.matched')}
            </span>
            <strong>{t('user.locateSuccess.confidence')}</strong>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="location-confirm-title">
          <div className={styles.panelHead}>
            <span className={styles.panelIcon}>
              <Icon name="target" size={18} />
            </span>
            <div>
              <span className={styles.eyebrow}>{t('user.locateSuccess.eyebrow')}</span>
              <h1 id="location-confirm-title">{t('user.locateSuccess.title')}</h1>
            </div>
          </div>

          <Card className={styles.locationCard}>
            <div className={styles.locationRow}>
              <Icon3d name="pin" iconSize={20} className={styles.mark} />
              <div className={styles.locationBody}>
                <b>{locationText}</b>
                <span>{t('user.locateSuccess.nearby')}</span>
              </div>
              <span className={styles.confirmedBadge}>
                <Icon name="check" size={11} />
                {t('user.locateSuccess.recognized')}
              </span>
            </div>
            <div className={styles.locationMeta}>
              <span>{t('user.locateSuccess.stationMeta')}</span>
              <span>{t('user.locateSuccess.accuracy')}</span>
            </div>
          </Card>

          <div className={styles.actions}>
            {/*
              안내 중 재인식으로 온 경우에는 경로를 다시 고르지 않고 안내로 돌아간다.
              (S15P11A206-141, 화면 정의서 U-10 "현재 위치 다시 인식")

              목적지와 경로는 이미 정해져 있고 바뀐 것은 현재 위치뿐이다. 기본 CTA로 보내면
              사용자가 목적지 선택부터 다시 밟는다.
            */}
            {relocalizing ? (
              <ButtonLink to={USER_ROUTES.NAVIGATION}>{t('user.locateSuccess.continue')}</ButtonLink>
            ) : (
              <ButtonLink to={USER_ROUTES.ROUTE_OPTIONS}>{t('user.locateSuccess.chooseRoute')}</ButtonLink>
            )}
            <GhostLink to={USER_ROUTES.CAPTURE_PORTRAIT} className={styles.retake}>
              {t('user.locateSuccess.retake')}
            </GhostLink>
          </div>
        </section>
      </>
    </PhoneFrame>
  );
}
