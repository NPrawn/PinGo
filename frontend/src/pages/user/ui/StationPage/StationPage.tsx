import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { DestinationSearch } from '@/features/destination-search';
import { StationSearch } from '@/features/station-search';
import { USER_ROUTES } from '@/shared/config';
import { localizeUserLabel } from '@/shared/lib/localizeUserLabel';
import { ButtonLink, Icon, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './StationPage.module.css';

type SelectionStep = 'origin' | 'destination' | 'summary';

const STEPS: readonly { id: SelectionStep; labelKey: string }[] = [
  { id: 'origin', labelKey: 'user.station.origin' },
  { id: 'destination', labelKey: 'user.station.destination' },
  { id: 'summary', labelKey: 'user.station.confirm' },
];

const STEP_INDEX: Record<SelectionStep, number> = {
  origin: 0,
  destination: 1,
  summary: 2,
};

/** Progressive origin and destination selection that keeps one task open at a time. */
export function StationPage() {
  const { t, i18n } = useTranslation();
  const station = useStationStore((state) => state.station);
  const destination = useNavigationStore((state) => state.destination);
  const destinationLabel = destination
    ? localizeUserLabel(destination, i18n.resolvedLanguage === 'en' ? 'en' : 'ko')
    : null;
  const [step, setStep] = useState<SelectionStep>('origin');
  const activeIndex = STEP_INDEX[step];

  return (
    <PhoneFrame bodyClassName={styles.body}>
      <div className={styles.mainHeader}>
        <span className={styles.wordmark}>PinGo</span>
        <Link
          to={USER_ROUTES.SETTINGS}
          className={styles.settingsLink}
          aria-label={t('user.station.settings')}
        >
          <span className={styles.settingsEmoji} aria-hidden>
            ⚙️
          </span>
        </Link>
      </div>

      <section className={styles.hero} aria-labelledby="home-title">
        <span className={styles.heroGlow} aria-hidden />
        <span className={styles.heroEyebrow}>{t('user.station.eyebrow')}</span>
        <Title id="home-title" className={styles.title}>
          {t('user.station.title')}
        </Title>
        <Sub className={styles.description}>
          {t('user.station.description')}
        </Sub>
        <ConsultCta
          variant="chip"
          label={t('user.station.consult')}
          className={styles.heroConsult}
        />
      </section>

      <nav className={styles.progress} aria-label={t('user.station.progressLabel')}>
        {STEPS.map((item, index) => {
          const complete = index < activeIndex;
          const active = index === activeIndex;

          return (
            <div
              key={item.id}
              className={[
                styles.progressItem,
                complete && styles.progressItemComplete,
                active && styles.progressItemActive,
              ]
                .filter(Boolean)
                .join(' ')}
              aria-current={active ? 'step' : undefined}
            >
              <span className={styles.progressDot}>
                {complete ? <Icon name="check" size={12} /> : index + 1}
              </span>
              <span>{t(item.labelKey)}</span>
              {index < STEPS.length - 1 && (
                <Icon name="arrow-right" size={13} className={styles.progressArrow} />
              )}
            </div>
          );
        })}
      </nav>

      {step === 'destination' && (
        <div className={styles.completedCard}>
          <div className={styles.completedIcon}>
            <Icon name="target" size={18} />
          </div>
          <div className={styles.completedBody}>
            <span>{t('user.station.origin')}</span>
            <strong>{station}</strong>
          </div>
          <button type="button" className={styles.changeButton} onClick={() => setStep('origin')}>
            {t('user.station.change')}
          </button>
        </div>
      )}

      {step === 'origin' && (
        <section
          className={`${styles.section} ${styles.originSection}`}
          aria-labelledby="origin-heading"
        >
          <div className={styles.sectionHead}>
            <span className={styles.step}>1</span>
            <div>
              <h2 id="origin-heading" className={styles.sectionTitle}>
                {t('user.station.originTitle')}
              </h2>
              <p className={styles.sectionMeta}>{t('user.station.originHint')}</p>
            </div>
            <Icon name="target" size={18} className={styles.sectionIcon} />
          </div>
          <StationSearch onSelect={() => setStep('destination')} />
        </section>
      )}

      {step === 'destination' && (
        <section
          className={`${styles.section} ${styles.sectionEntering}`}
          aria-labelledby="destination-heading"
        >
          <div className={styles.sectionHead}>
            <span className={styles.step}>2</span>
            <div>
              <h2 id="destination-heading" className={styles.sectionTitle}>
                {t('user.station.destinationTitle')}
              </h2>
              <p className={styles.sectionMeta}>{t('user.station.destinationHint')}</p>
            </div>
            <Icon name="pin" size={18} className={styles.sectionIcon} />
          </div>
          <DestinationSearch
            nextRoute={USER_ROUTES.CAPTURE_GUIDE}
            compact
            deferNavigation
            onSelect={() => setStep('summary')}
          />
        </section>
      )}

      {step === 'summary' && destinationLabel && (
        <section
          className={`${styles.summaryCard} ${styles.sectionEntering}`}
          aria-labelledby="summary-heading"
        >
          <div className={styles.summaryHeading}>
            <span className={styles.step}>
              <Icon name="check" size={13} />
            </span>
            <div>
              <h2 id="summary-heading" className={styles.sectionTitle}>
                {t('user.station.summaryTitle')}
              </h2>
              <p className={styles.sectionMeta}>{t('user.station.summaryHint')}</p>
            </div>
          </div>

          <div
            className={styles.routeSummary}
            aria-label={t('user.station.routeLabel', {
              origin: station,
              destination: destinationLabel,
            })}
          >
            <div className={styles.routePoint}>
              <div className={styles.routePointBody}>
                <span>{t('user.station.origin')}</span>
                <strong>{station}</strong>
              </div>
              <button
                type="button"
                className={styles.routeEditButton}
                onClick={() => setStep('origin')}
              >
                {t('user.station.edit')}
              </button>
            </div>
            <span className={styles.routeArrow}>
              <Icon name="arrow-right" size={20} />
            </span>
            <div className={styles.routePoint}>
              <div className={styles.routePointBody}>
                <span>{t('user.station.destination')}</span>
                <strong>{destinationLabel}</strong>
              </div>
              <button
                type="button"
                className={styles.routeEditButton}
                onClick={() => setStep('destination')}
              >
                {t('user.station.edit')}
              </button>
            </div>
          </div>

          <ButtonLink to={USER_ROUTES.CAPTURE_GUIDE} className={styles.continueButton}>
            {t('user.station.startCapture')}
            <Icon name="arrow-right" size={17} />
          </ButtonLink>
        </section>
      )}
    </PhoneFrame>
  );
}
