import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import {
  Blob,
  BlobHero,
  BlobPin,
  ButtonLink,
  Card,
  GhostLink,
  Icon3d,
  LivePill,
  Spring,
  Title,
} from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './LocateSuccessPage.module.css';

/** Screen 10 (FR-U-006) — the scan placed the user successfully. */
export function LocateSuccessPage() {
  const station = useStationStore((state) => state.station);

  return (
    <PhoneFrame layout="flush">
      <>
        <div className={styles.topPill}>
          <LivePill tone="gps">LIVE · 인식 완료</LivePill>
          <ConsultCta variant="icon" />
        </div>
        <div className={styles.topSpacer} />

        <div className={styles.content}>
          <BlobHero className={styles.hero}>
            <Blob slot="main" style={{ width: 118, height: 118 }} />
            <Blob
              tone="coral"
              slot="a"
              style={{ top: '12%', right: '22%', width: 42, height: 42 }}
            />
            <Blob
              tone="lilac"
              slot="b"
              style={{ bottom: '12%', left: '22%', width: 34, height: 34 }}
            />
            <BlobPin>
              <span className={styles.check}>✓</span>
            </BlobPin>
          </BlobHero>

          <Title center className={styles.title}>
            {station},
            <br />
            현재 위치를 찾았어요
          </Title>

          <Card className={styles.card}>
            <div className={styles.row}>
              <Icon3d name="pin" iconSize={20} className={styles.mark} />
              <div className={styles.rowBody}>
                <b className={styles.place}>{station} · B1 대합실</b>
                <br />
                <span className={styles.detail}>3번 출구 방면 · 12번 기둥 부근</span>
              </div>
            </div>
            <div className={styles.confidenceRow}>
              <span className={styles.confidence}>
                <span className={styles.confidenceDot} aria-hidden />
                신뢰도 92%
              </span>
              <span className={styles.confidenceNote}>VPS 인식 성공</span>
            </div>
          </Card>
        </div>

        <Spring />

        <div className={styles.actions}>
          <ButtonLink to={USER_ROUTES.DESTINATION}>목적지 검색하기 →</ButtonLink>
          <GhostLink to={USER_ROUTES.CAPTURE_GUIDE} className={styles.retake}>
            이 위치가 아니에요 · 다시 촬영
          </GhostLink>
        </div>
      </>
    </PhoneFrame>
  );
}
