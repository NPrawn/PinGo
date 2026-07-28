import { USER_ROUTES } from '@/shared/config';
import { BackLink, ButtonLink, Card, GhostLink, LivePill, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './OfflinePage.module.css';

const CAPABILITIES = [
  { label: '턴바이턴 경로 안내', available: true },
  { label: '저장된 실내 지도', available: true },
  { label: '실시간 위치 재인식 · 연결 필요', available: false },
  { label: '상담원 연결 · 연결 필요', available: false },
];

/**
 * Screen 23 — the connection dropped underground.
 *
 * TODO: Drive from the real online/offline state and the cached-route store
 * once offline persistence is implemented.
 */
export function OfflinePage() {
  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <BackLink to={USER_ROUTES.NAVIGATION}>안내 화면으로</BackLink>
      <LivePill className={styles.offlinePill} dotClassName={styles.offlineDot}>
        연결 끊김 · 재연결 시도 중
      </LivePill>
      <Title className={styles.title}>
        지하 구간이라
        <br />
        연결이 불안정해요
      </Title>
      <Sub>
        실시간 안내는 잠시 멈췄지만, 이미 받은 경로는{' '}
        <b className={styles.strong}>오프라인으로 계속</b> 보실 수 있어요.
      </Sub>

      <Card className={styles.card}>
        <div className={styles.savedRow}>
          <span className={styles.savedMark}>
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0EA36F"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <div className={styles.savedBody}>
            <div className={styles.savedTitle}>저장된 경로 · 3번 출구</div>
            <div className={styles.savedMeta}>210m · 도보 4분 · 12:04 기준</div>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.capabilities}>
          {CAPABILITIES.map((capability) => (
            <div
              key={capability.label}
              className={[styles.capability, !capability.available && styles.capabilityOff]
                .filter(Boolean)
                .join(' ')}
            >
              <span
                className={[styles.capabilityDot, !capability.available && styles.capabilityDotOff]
                  .filter(Boolean)
                  .join(' ')}
                aria-hidden
              />
              {capability.label}
            </div>
          ))}
        </div>
      </Card>

      <Card className={styles.retryCard}>
        <span className={styles.retrySpinner} aria-hidden />
        <span className={styles.retryText}>자동으로 다시 연결 중 · 12초 경과</span>
      </Card>

      <Spring />
      <ButtonLink to={USER_ROUTES.NAVIGATION}>오프라인 경로로 계속</ButtonLink>
      <GhostLink to={USER_ROUTES.NAVIGATION} className={styles.retryLink}>
        지금 다시 연결 시도 →
      </GhostLink>
    </PhoneFrame>
  );
}
