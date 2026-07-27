import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, Card, Kicker, LivePill, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './LocateFailedPage.module.css';

/** TODO: Replace with the real capture quality report from the VPS attempt. */
const SHOTS = [
  { label: '정면', blurred: true },
  { label: '오른쪽', blurred: false },
  { label: '뒤쪽', blurred: true },
];

const TIPS = [
  { before: '역 이름·출구 번호 ', strong: '표지판이 보이게', after: ' 비춰주세요' },
  { before: '사람이 적은 쪽으로 ', strong: '2~3걸음', after: ' 이동해 주세요' },
  { before: '멈춰 선 채로 ', strong: '천천히', after: ' 한 바퀴 돌려주세요' },
];

function ShotScene({ blurred }: { blurred: boolean }) {
  return (
    <svg
      viewBox="0 0 90 64"
      preserveAspectRatio="none"
      className={[styles.shotScene, blurred && styles.shotSceneBlurred].filter(Boolean).join(' ')}
      aria-hidden
    >
      <path d="M0 64 L34 34 H56 L90 64 Z" fill="rgba(60,216,160,0.10)" />
      <path
        d="M0 64 L34 34 M90 64 L56 34 M34 34 H56"
        stroke="rgba(127,239,195,0.35)"
        strokeWidth="1"
        fill="none"
      />
      <rect x="37" y="16" width="16" height="7" rx="2" fill="rgba(127,239,195,0.3)" />
    </svg>
  );
}

/** Screen 07 (FR-U-005) — the scan could not place the user. */
export function LocateFailedPage() {
  const blurred = SHOTS.filter((shot) => shot.blurred).length;

  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <LivePill className={styles.failPill} dotClassName={styles.failDot}>
        인식 실패 · 다시 시도해요
      </LivePill>
      <Title className={styles.title}>
        주변 정보가
        <br />
        조금 부족했어요
      </Title>
      <Sub>
        사람이 많거나 화면이 흔들려서 위치를 특정하지 못했어요. 아래 방법 중 하나로 이어서 진행할 수
        있어요.
      </Sub>

      <Card className={styles.card}>
        <div className={styles.cardHead}>
          <Kicker className={styles.cardKicker}>방금 촬영한 화면</Kicker>
          <span className={styles.blurCount}>
            {SHOTS.length}장 중 {blurred}장 흐림
          </span>
        </div>
        <div className={styles.shots}>
          {SHOTS.map((shot) => (
            <div key={shot.label} className={styles.shot}>
              <ShotScene blurred={shot.blurred} />
              <span className={styles.shotLabel}>{shot.label}</span>
              <span
                className={[
                  styles.shotBadge,
                  shot.blurred ? styles.shotBadgeBlurred : styles.shotBadgeOk,
                ].join(' ')}
              >
                {shot.blurred ? '흐림' : '양호'}
              </span>
            </div>
          ))}
        </div>

        <div className={styles.divider} />
        <Kicker className={styles.tipsKicker}>이렇게 하면 더 잘 인식돼요</Kicker>
        <div className={styles.tips}>
          {TIPS.map((tip, index) => (
            <div key={tip.strong} className={styles.tip}>
              <span className={styles.tipNumber}>{index + 1}</span>
              <span className={styles.tipText}>
                {tip.before}
                <b>{tip.strong}</b>
                {tip.after}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Spring />

      <div className={styles.actions}>
        <ButtonLink to={USER_ROUTES.CAPTURE_GUIDE}>다시 촬영하기</ButtonLink>
        <div className={styles.actionRow}>
          <ButtonLink
            to={USER_ROUTES.LOCATE_MANUAL}
            variant="secondary"
            className={styles.actionHalf}
          >
            지도에서 선택
          </ButtonLink>
          <ConsultCta className={styles.actionHalf} />
        </div>
      </div>
    </PhoneFrame>
  );
}
