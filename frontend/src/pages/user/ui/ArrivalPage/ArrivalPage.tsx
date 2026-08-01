import { useNavigationStore } from '@/entities/navigation';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { Blob, BlobHero, BlobPin, ButtonLink, LivePill, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ArrivalPage.module.css';

/** Screen 21 (FR-U-011) — the user reached the destination. */
export function ArrivalPage() {
  const route = useNavigationStore((state) => state.route);
  const destination = useNavigationStore((state) => state.destination) ?? '선택한 목적지';
  const destinationLatitude = useNavigationStore((state) => state.destinationLatitude);
  const destinationLongitude = useNavigationStore((state) => state.destinationLongitude);
  // TODO: 출구는 경로 응답(8.2)의 마지막 노드에서 와야 한다. 프로토타입에서 옮겨온 값이다.
  const exit = route === 'elevator_only' ? '2번 출입구' : '7번 출입구';

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
