import { StationSearch } from '@/features/station-search';
import { USER_ROUTES } from '@/shared/config';
import { BackLink, ButtonLink, LivePill, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './StationPage.module.css';

/** Screen 04 (FR-U-003) — confirm which station the user is in. */
export function StationPage() {
  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <BackLink to={USER_ROUTES.PERMISSION}>권한 설정</BackLink>
      <LivePill tone="gps">GPS · 주변 역 감지</LivePill>
      <Title className={styles.title}>
        현재 역을
        <br />
        확인해 주세요
      </Title>
      <Sub>
        주변 역 목록에서 선택하거나,
        <br />역 이름을 직접 검색할 수 있어요.
      </Sub>

      <StationSearch />

      <Spring />
      <ButtonLink to={USER_ROUTES.CAPTURE_GUIDE} className={styles.cta}>
        이 역으로 계속하기
      </ButtonLink>
    </PhoneFrame>
  );
}
