import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ConsultCta } from '@/features/consult-request';
import { DestinationSearch } from '@/features/destination-search';
import { StationSearch } from '@/features/station-search';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, Icon, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './StationPage.module.css';

type SelectionStep = 'origin' | 'destination' | 'summary';

const STEPS: readonly { id: SelectionStep; label: string }[] = [
  { id: 'origin', label: '출발지' },
  { id: 'destination', label: '목적지' },
  { id: 'summary', label: '최종 확인' },
];

const STEP_INDEX: Record<SelectionStep, number> = {
  origin: 0,
  destination: 1,
  summary: 2,
};

/** Progressive origin and destination selection that keeps one task open at a time. */
export function StationPage() {
  const station = useStationStore((state) => state.station);
  const destination = useNavigationStore((state) => state.destination);
  const [step, setStep] = useState<SelectionStep>('origin');
  const activeIndex = STEP_INDEX[step];

  return (
    <PhoneFrame bodyClassName={styles.body}>
      <div className={styles.mainHeader}>
        <span className={styles.wordmark}>PinGo</span>
        <Link to={USER_ROUTES.SETTINGS} className={styles.settingsLink} aria-label="설정">
          <span className={styles.settingsEmoji} aria-hidden>
            ⚙️
          </span>
        </Link>
      </div>

      <section className={styles.hero} aria-labelledby="home-title">
        <span className={styles.heroGlow} aria-hidden />
        <span className={styles.heroEyebrow}>HOME · 지하철 실내 길찾기</span>
        <Title id="home-title" className={styles.title}>
          오늘은 어디로 가시나요?
        </Title>
        <Sub className={styles.description}>
          출발지와 목적지만 고르면 역 안의 길을 안내해 드려요.
        </Sub>
        <ConsultCta variant="chip" label="상담 연결하기" className={styles.heroConsult} />
      </section>

      <nav className={styles.progress} aria-label="출발지와 목적지 선택 단계">
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
              <span>{item.label}</span>
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
            <span>출발지</span>
            <strong>{station}</strong>
          </div>
          <button type="button" className={styles.changeButton} onClick={() => setStep('origin')}>
            변경
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
                출발지 선택
              </h2>
              <p className={styles.sectionMeta}>역을 선택하면 다음 단계가 열려요</p>
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
                목적지 선택
              </h2>
              <p className={styles.sectionMeta}>장소를 고르면 최종 확인으로 이어져요</p>
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

      {step === 'summary' && destination && (
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
                출발지와 목적지
              </h2>
              <p className={styles.sectionMeta}>선택이 완료되었어요</p>
            </div>
          </div>

          <div className={styles.routeSummary} aria-label={`${station}에서 ${destination}까지`}>
            <div className={styles.routePoint}>
              <div className={styles.routePointBody}>
                <span>출발지</span>
                <strong>{station}</strong>
              </div>
              <button
                type="button"
                className={styles.routeEditButton}
                onClick={() => setStep('origin')}
              >
                수정
              </button>
            </div>
            <span className={styles.routeArrow}>
              <Icon name="arrow-right" size={20} />
            </span>
            <div className={styles.routePoint}>
              <div className={styles.routePointBody}>
                <span>목적지</span>
                <strong>{destination}</strong>
              </div>
              <button
                type="button"
                className={styles.routeEditButton}
                onClick={() => setStep('destination')}
              >
                수정
              </button>
            </div>
          </div>

          <ButtonLink to={USER_ROUTES.CAPTURE_GUIDE} className={styles.continueButton}>
            이 경로로 촬영 시작
            <Icon name="arrow-right" size={17} />
          </ButtonLink>
        </section>
      )}
    </PhoneFrame>
  );
}
