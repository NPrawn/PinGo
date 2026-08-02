import { useNavigationStore } from '@/entities/navigation';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { Blob, BlobHero, BlobPin, ButtonLink, LivePill, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ArrivalPage.module.css';

/** Screen 21 (FR-U-011) — the user reached the destination. */
export function ArrivalPage() {
  const destination = useNavigationStore((state) => state.destination) ?? '선택한 목적지';
  const destinationLatitude = useNavigationStore((state) => state.destinationLatitude);
  const destinationLongitude = useNavigationStore((state) => state.destinationLongitude);
  // 안내가 실제로 도착한 출입구. 경로 옵션 화면이 유형별로 정해 스토어에 남긴 값이다.
  const targetExitLabel = useNavigationStore((state) => state.targetExitLabel);
  const exit = targetExitLabel ?? '출입구';

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
          {exit}에
          <br />
          도착했습니다
        </Title>
        <Sub center className={styles.sub}>
          {destination}에서 가까운 출입구예요.
          <br />
          안전하게 이동을 마무리해 주세요.
        </Sub>

        <Spring />

        <ButtonLink
          to={
            destinationLatitude != null && destinationLongitude != null
              ? USER_ROUTES.EXTERNAL_MAP
              : USER_ROUTES.STATION
          }
          className={styles.cta}
        >
          {destinationLatitude != null && destinationLongitude != null
            ? '외부 도보 길찾기'
            : '새로운 길 안내 시작'}
        </ButtonLink>
        <ConsultCta size="sm" className={styles.consult} />
      </>
    </PhoneFrame>
  );
}
