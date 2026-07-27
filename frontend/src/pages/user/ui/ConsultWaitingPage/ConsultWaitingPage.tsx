import { USER_ROUTES } from '@/shared/config';
import {
  Blob,
  BlobHero,
  BlobPin,
  ButtonLink,
  Card,
  GhostLink,
  Icon,
  LivePill,
  Spring,
  Sub,
  Title,
} from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ConsultWaitingPage.module.css';

/**
 * Screen 19 (FR-U-014) — waiting in the consult queue.
 *
 * TODO: Advance automatically when the counselor accepts, once the signalling
 * events are wired. The prototype required a manual tap.
 */
export function ConsultWaitingPage() {
  return (
    <PhoneFrame bodyClassName={styles.body}>
      <>
        <LivePill>CONNECTING · 상담 대기 중</LivePill>

        <BlobHero className={styles.hero}>
          <span className={styles.ripple} aria-hidden />
          <span className={`${styles.ripple} ${styles.rippleDelayed}`} aria-hidden />
          <Blob slot="main" style={{ width: 160, height: 160 }} />
          <Blob tone="lilac" slot="a" style={{ top: '8%', right: '14%', width: 48, height: 48 }} />
          <Blob
            tone="coral"
            slot="b"
            style={{ bottom: '10%', left: '16%', width: 38, height: 38 }}
          />
          <BlobPin>
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden>
              <circle cx="16" cy="11" r="6" fill="#0EA36F" />
              <path
                d="M16 19c-6 0-10.5 4-10.5 9.2A1.8 1.8 0 007.3 30h17.4a1.8 1.8 0 001.8-1.8C26.5 23 22 19 16 19z"
                fill="#3CD8A0"
              />
            </svg>
          </BlobPin>
        </BlobHero>

        <Title className={styles.title}>
          상담원을
          <br />
          연결하고 있어요
        </Title>
        <Sub className={styles.sub}>잠시만 기다려 주세요 · 평균 30초 소요</Sub>

        <Card className={styles.tip}>
          <span className={styles.tipIcon}>
            <Icon name="bulb" size={18} />
          </span>
          <div className={styles.tipCopy}>
            <strong className={styles.tipTitle}>상담원 연결이 어려운 경우</strong>
            <span className={styles.tipLine}>
              <b>B1 고객안내센터</b>를 방문해 주세요.
            </span>
            <span className={styles.tipLine}>역무원에게 보여줄 안내 문장이 준비되어 있어요.</span>
          </div>
        </Card>

        <Spring />
        <ButtonLink to={USER_ROUTES.CONSULT_SESSION} variant="secondary" className={styles.primary}>
          연결됨 · 상담 화면 보기
        </ButtonLink>
        <GhostLink to={USER_ROUTES.NAVIGATION} className={styles.cancel}>
          요청 취소
        </GhostLink>
      </>
    </PhoneFrame>
  );
}
