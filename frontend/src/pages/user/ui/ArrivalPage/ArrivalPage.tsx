import { useTranslation } from 'react-i18next';
import { useNavigationStore } from '@/entities/navigation';
import { ConsultCta } from '@/features/consult-request';
import { USER_ROUTES } from '@/shared/config';
import { localizeUserLabel } from '@/shared/lib/localizeUserLabel';
import { Blob, BlobHero, BlobPin, ButtonLink, LivePill, Spring, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ArrivalPage.module.css';

/** Screen 21 (FR-U-011) — the user reached the destination. */
export function ArrivalPage() {
  const { t, i18n } = useTranslation();
  const storedDestination = useNavigationStore((state) => state.destination);
  const destination = storedDestination
    ? localizeUserLabel(storedDestination, i18n.resolvedLanguage === 'en' ? 'en' : 'ko')
    : t('user.arrival.selected');
  // 안내가 실제로 도착한 출입구. 경로 옵션 화면이 유형별로 정해 스토어에 남긴 값이다.
  const targetExitLabel = useNavigationStore((state) => state.targetExitLabel);
  const exit = targetExitLabel ?? t('user.arrival.entrance');

  return (
    <PhoneFrame layout="hero" bodyClassName={styles.body}>
      <>
        <LivePill tone="gps" className={styles.pill}>
          {t('user.arrival.pill')}
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

        <Title className={styles.title} style={{ whiteSpace: 'pre-line' }}>
          {t('user.arrival.title', { exit })}
        </Title>
        <Sub center className={styles.sub} style={{ whiteSpace: 'pre-line' }}>
          {t('user.arrival.description', { destination })}
        </Sub>

        <Spring />

        {/*
          안내는 출입구에서 끝난다.

          역 밖 도보 길찾기는 다루지 않기로 했으므로 목적지 좌표가 있든 없든 다음 행동은
          하나다 — 새 여정을 시작하는 것.
        */}
        <ButtonLink to={USER_ROUTES.STATION} className={styles.cta}>
          {t('user.arrival.restart')}
        </ButtonLink>
        <ConsultCta size="sm" className={styles.consult} />
      </>
    </PhoneFrame>
  );
}
