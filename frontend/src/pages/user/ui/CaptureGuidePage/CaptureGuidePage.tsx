import { useStationStore } from '@/entities/station';
import { USER_ROUTES } from '@/shared/config';
import { BackLink, ButtonLink, Card, GhostLink, LivePill, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './CaptureGuidePage.module.css';

const TIPS = [
  {
    title: '발은 그대로, 몸만 회전',
    body: '자리를 옮기지 않아야 위치가 정확해요',
  },
  {
    title: '가로로 들면 더 넓게',
    body: '한 번에 담기는 범위가 약 2배 넓어져요',
  },
  {
    title: '표지판이 보이면 잠깐 멈춤',
    body: '역 이름·기둥 번호가 인식 정확도를 높여요',
  },
];

/** Screen 05 (FR-U-004) — how to capture the surroundings. */
export function CaptureGuidePage() {
  const station = useStationStore((state) => state.station);

  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <BackLink to={USER_ROUTES.STATION}>역 다시 선택</BackLink>
      <LivePill tone="gps">{station} · 위치 인식</LivePill>
      <Title className={styles.title}>
        제자리에서 주변을
        <br />한 바퀴 담아주세요
      </Title>
      <Sub>
        촬영한 주변 모습으로
        <br />
        지금 서 있는 정확한 위치를 찾아드려요.
      </Sub>

      <div className={styles.radar} aria-hidden>
        <div className={styles.ringOuter} />
        <div className={styles.ringInner} />
        <div className={styles.sweep} />
        <div className={styles.mask} />
        <div className={styles.deviceWrap}>
          <svg width="26" height="42" viewBox="0 0 26 42" className={styles.device}>
            <rect
              x="1"
              y="1"
              width="24"
              height="40"
              rx="5"
              fill="rgba(127,239,195,.16)"
              stroke="#7FEFC3"
              strokeWidth="1.6"
            />
            <circle cx="13" cy="10" r="3" fill="#7FEFC3" />
          </svg>
        </div>
        <span className={`${styles.compass} ${styles.compassTop}`}>정면</span>
        <span className={`${styles.compass} ${styles.compassBottom}`}>뒤쪽</span>
        <span className={`${styles.compass} ${styles.compassLeft}`}>왼쪽</span>
        <span className={`${styles.compass} ${styles.compassRight}`}>오른쪽</span>
      </div>

      <Card className={styles.tips}>
        {TIPS.map((tip, index) => (
          <div key={tip.title} className={styles.tip}>
            <span className={styles.tipNumber}>{index + 1}</span>
            <div>
              <div className={styles.tipTitle}>{tip.title}</div>
              <div className={styles.tipBody}>{tip.body}</div>
            </div>
          </div>
        ))}
      </Card>

      <Spring />
      <ButtonLink to={USER_ROUTES.CAPTURE_LANDSCAPE}>가로로 촬영 시작</ButtonLink>
      <GhostLink to={USER_ROUTES.CAPTURE_PORTRAIT} className={styles.altLink}>
        세로로 촬영할게요 →
      </GhostLink>
    </PhoneFrame>
  );
}
