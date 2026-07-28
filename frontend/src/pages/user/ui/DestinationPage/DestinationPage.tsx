import { Link } from 'react-router-dom';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { DestinationSearch } from '@/features/destination-search';
import { USER_ROUTES } from '@/shared/config';
import { Blob, Card, Kicker, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './DestinationPage.module.css';

/** Screen 12 (FR-U-007) — search for a destination. */
export function DestinationPage() {
  const station = useStationStore((state) => state.station);

  return (
    <PhoneFrame overlay={<ConsultCta variant="icon" className={styles.consult} />}>
      <div className={styles.topSpacer} />

      <div className={styles.header}>
        <div>
          <Kicker>오후 2:14 · 현재 위치</Kicker>
          <Title className={styles.greeting}>안녕, {station}</Title>
        </div>
        <Link to={USER_ROUTES.SETTINGS} className={styles.settingsLink} aria-label="설정">
          <span className={styles.settingsEmoji} aria-hidden>
            ⚙️
          </span>
        </Link>
      </div>

      <Card className={styles.originCard}>
        <Blob className={styles.originBlob} />
        <div className={styles.originRow}>
          <div className={styles.originBody}>
            <span className={styles.originBadge}>
              <span className={styles.originBadgeDot} aria-hidden />
              출발지 · 인식 완료
            </span>
            <div className={styles.originName}>{station} B1 대합실</div>
            <div className={styles.originMeta}>12번 기둥 앞 · 2호선 · 출구 1-8</div>
          </div>
          <Link to={USER_ROUTES.CAPTURE_GUIDE} className={styles.rescan}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0EA36F"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M20 11a8 8 0 10-2.3 5.6" />
              <path d="M20 5v6h-6" />
            </svg>
            <span className={styles.rescanLabel}>다시 인식</span>
          </Link>
        </div>
      </Card>

      <DestinationSearch />
    </PhoneFrame>
  );
}
