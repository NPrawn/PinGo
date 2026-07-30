import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SATISFACTION_LABELS, useConsultStore } from '@/entities/consult';
import { USER_ROUTES } from '@/shared/config';
import { Icon, MapPreview, Sub } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ConsultEndedPage.module.css';

const FLOORS = ['1F', 'B1', 'B2'];
const STARS = [1, 2, 3, 4, 5];
/** Keep the selected score visible briefly before returning to destination search. */
const DISMISS_MS = 550;

/** Screen 26 — consultation ended, collect a satisfaction rating. */
export function ConsultEndedPage() {
  const navigate = useNavigate();
  const satisfaction = useConsultStore((state) => state.satisfaction);
  const rate = useConsultStore((state) => state.rate);
  const [rated, setRated] = useState(false);

  useEffect(() => {
    if (!rated) return;
    const timer = setTimeout(() => void navigate(USER_ROUTES.STATION), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [rated, navigate]);

  return (
    <PhoneFrame layout="flush" bodyClassName={styles.body} statusBarClassName={styles.statusBar}>
      <>
        <div className={styles.backdrop} aria-hidden>
          <div className={styles.cam}>
            <div className={styles.arrow}>↑</div>
          </div>
          <div className={styles.mapWrap}>
            <MapPreview
              className={styles.map}
              me={{ left: '40%', top: '70%' }}
              dest={{ left: '74%', top: '22%' }}
            >
              <div className={styles.floorButtons}>
                {FLOORS.map((floor, index) => (
                  <span
                    key={floor}
                    className={[styles.floorButton, index === 0 && styles.floorButtonOn]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {floor}
                  </span>
                ))}
              </div>
            </MapPreview>
          </div>
        </div>

        <div className={styles.scrim}>
          <div className={styles.dialog} role="dialog" aria-label="상담이 종료되었어요">
            <div className={styles.mark}>
              <Icon name="chat" size={28} />
            </div>
            <h2 className={styles.heading}>상담이 종료되었어요</h2>
            <Sub center className={styles.lede}>
              별점을 남기면 목적지 검색으로 이동해요
            </Sub>

            <div className={styles.stars}>
              {STARS.map((score) => (
                <button
                  key={score}
                  type="button"
                  className={styles.star}
                  style={{ color: score <= satisfaction ? '#F0B36A' : '#CFE2D5' }}
                  aria-label={`${score}점`}
                  onClick={() => {
                    rate(score);
                    setRated(true);
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            {satisfaction > 0 && (
              <p className={styles.ratingLabel}>{SATISFACTION_LABELS[satisfaction]}</p>
            )}
          </div>
        </div>
      </>
    </PhoneFrame>
  );
}
