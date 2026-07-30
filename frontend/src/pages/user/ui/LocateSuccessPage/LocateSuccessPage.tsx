import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, Card, GhostLink, Icon, Icon3d } from '@/shared/ui';
import { ViewfinderBack } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './LocateSuccessPage.module.css';

/** Keep the live camera visible while the user confirms the matched position. */
export function LocateSuccessPage() {
  const station = useStationStore((state) => state.station);
  const floor = useStationStore((state) => state.floor);
  const currentLocationLabel = useNavigationStore((state) => state.currentLocationLabel);
  const locationText = currentLocationLabel ?? `${station} · ${floor}`;

  return (
    <PhoneFrame layout="flush" bodyClassName={styles.body} statusBarClassName={styles.statusBar}>
      <>
        <section className={styles.camera} aria-label="후면 카메라 화면">
          <div className={styles.topBar}>
            <ViewfinderBack to={USER_ROUTES.CAPTURE_PORTRAIT} />
            <ConsultCta variant="icon" />
          </div>

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
          </svg>

          <div className={styles.horizon} aria-hidden />
          <div className={styles.cornerLeft} aria-hidden />
          <div className={styles.cornerRight} aria-hidden />

          <div className={styles.cameraResult}>
            <span className={styles.cameraCheck}>
              <Icon name="check" size={22} />
            </span>
            <strong>현재 위치를 찾았어요</strong>
            <span>{locationText}</span>
          </div>

          <div className={styles.cameraMeta}>
            <span>
              <span className={styles.confidenceDot} aria-hidden />
              VPS 매칭 완료
            </span>
            <strong>신뢰도 92%</strong>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="location-confirm-title">
          <div className={styles.panelHead}>
            <span className={styles.panelIcon}>
              <Icon name="target" size={18} />
            </span>
            <div>
              <span className={styles.eyebrow}>현재 위치 확인</span>
              <h1 id="location-confirm-title">여기가 맞는지 확인해 주세요</h1>
            </div>
          </div>

          <Card className={styles.locationCard}>
            <div className={styles.locationRow}>
              <Icon3d name="pin" iconSize={20} className={styles.mark} />
              <div className={styles.locationBody}>
                <b>{locationText}</b>
                <span>3번 출구 방면 · 12번 기둥 부근</span>
              </div>
              <span className={styles.confirmedBadge}>
                <Icon name="check" size={11} />
                인식 완료
              </span>
            </div>
            <div className={styles.locationMeta}>
              <span>2호선 · 출구 1–8</span>
              <span>오차 범위 약 1.2m</span>
            </div>
          </Card>

          <div className={styles.actions}>
            <ButtonLink to={USER_ROUTES.ROUTE_OPTIONS}>이 위치에서 경로 선택하기 →</ButtonLink>
            <GhostLink to={USER_ROUTES.CAPTURE_PORTRAIT} className={styles.retake}>
              이 위치가 아니에요 · 다시 촬영
            </GhostLink>
          </div>
        </section>
      </>
    </PhoneFrame>
  );
}
