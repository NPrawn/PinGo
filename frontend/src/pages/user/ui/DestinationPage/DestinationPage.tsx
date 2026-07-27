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
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#0F2C22"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 8.9a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V10a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
          </svg>
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
