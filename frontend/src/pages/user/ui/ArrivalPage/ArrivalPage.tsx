import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import {
  Blob,
  BlobHero,
  BlobPin,
  ButtonLink,
  GhostLink,
  Icon,
  LivePill,
  Spring,
  Sub,
  Title,
} from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ArrivalPage.module.css';

/** Screen 21 (FR-U-011) — the user reached the destination. */
export function ArrivalPage() {
  return (
    <PhoneFrame layout="hero" bodyClassName={styles.body}>
      <>
        <LivePill tone="gps" className={styles.pill}>
          ARRIVED · 도착 완료
        </LivePill>

        <BlobHero className={styles.hero}>
          <Blob slot="main" style={{ width: 170, height: 170 }} />
          <Blob tone="coral" slot="a" style={{ top: '6%', right: '14%', width: 52, height: 52 }} />
          <Blob
            tone="lilac"
            slot="b"
            style={{ bottom: '8%', left: '14%', width: 42, height: 42 }}
          />
          <Blob tone="sky" slot="c" style={{ top: '18%', left: '8%', width: 34, height: 34 }} />
          <BlobPin>
            <span className={styles.check}>✓</span>
          </BlobPin>
        </BlobHero>

        <Title className={styles.title}>
          3번 출구에
          <br />
          도착했습니다
        </Title>
        <Sub center className={styles.sub}>
          이용해 주셔서 감사합니다.
          <br />
          다음 목적지도 이어서 안내해드릴게요.
        </Sub>

        <Spring />

        <ButtonLink to={USER_ROUTES.EXTERNAL_MAP} className={styles.cta}>
          <Icon name="compass" size={16} />
          카카오지도로 이어서 길찾기
        </ButtonLink>
        <ConsultCta size="sm" className={styles.consult} />
        <GhostLink to={USER_ROUTES.CONSULT_ENDED} className={styles.secondary}>
          상담 만족도 남기고 종료
        </GhostLink>
      </>
    </PhoneFrame>
  );
}
