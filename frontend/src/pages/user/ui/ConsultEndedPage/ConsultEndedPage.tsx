import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SATISFACTION_LABELS, useConsultStore } from '@/entities/consult';
import { useUserSessionStore } from '@/entities/user-session';
import { releaseConsultMedia } from '@/features/consult-signaling';
import { ApiError, rateConsultation } from '@/shared/api';
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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const satisfaction = useConsultStore((state) => state.satisfaction);
  const rate = useConsultStore((state) => state.rate);
  const clearConsultation = useConsultStore((state) => state.clearConsultation);
  const consultationId = useConsultStore((state) => state.consultationId);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const [rated, setRated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * 평가 API에 쓸 상담 ID를 화면에 들어오는 시점 값으로 고정해 둔다.
   *
   * store의 `consultationId`는 아래에서 마운트하자마자 지운다 — 상담자가 먼저 끊었을 때도
   * 사용자 쪽 정리가 곧바로 끝나야 하고, 이 화면에 왔다가 별점을 남기지 않고 나가도(뒤로
   * 가기 등) 이미 끝난 상담의 방 번호가 sessionStorage에 남아 있으면 안 되기 때문이다.
   * 그런데 store를 그대로 지우면 뒤이어 별을 누를 때 매길 대상이 없어져 평가 API가 아예
   * 호출되지 않는다.
   *
   * `useState`의 초기값 인자는 최초 렌더에서 한 번만 쓰이고 이후 리렌더에서는 무시된다 —
   * 렌더는 항상 effect보다 먼저 실행되므로, 아래 effect가 store를 비우기 전인 이 시점의
   * `consultationId`를 그대로 고정할 수 있다. (store를 unmount 시점에 비우고 그동안
   * 구독값을 그대로 쓰는 방식도 검토했지만, 개발 모드 StrictMode가 mount 직후 이 화면의
   * effect를 한 번 더 정리·재실행하면서 별을 누르기도 전에 store가 비어, 로컬 개발 중
   * 평가 API가 호출되지 않는 문제가 있어 이 방식을 유지한다.)
   */
  const [ratingConsultationId] = useState(consultationId);

  /**
   * 상담이 끝났으니 공유하던 화면과 마이크를 놓아 주고, 상담 정보도 곧바로 비운다.
   *
   * 상담 화면의 언마운트에 맡기지 않는 이유는, 개발 모드의 StrictMode 가 정리 함수를 마운트
   * 직후에도 한 번 실행해서 상담이 시작되기도 전에 스트림이 사라지기 때문이다. 상담이 실제로
   * 끝나는 이 화면에서 한 번만 정리한다.
   *
   * 예전에는 별점을 남긴 뒤에만 store를 비웠다. 그러면 상담자가 먼저 끊은 경우 사용자가
   * 별점을 남기지 않는 한 정리가 끝나지 않아, 상담자 쪽 종료 정리(즉시 비움)와 비대칭이었다.
   */
  useEffect(() => {
    releaseConsultMedia();
    clearConsultation();
  }, [clearConsultation]);

  useEffect(() => {
    if (!rated) return;
    const timer = setTimeout(() => void navigate(USER_ROUTES.STATION), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [rated, navigate]);

  const submitRating = async (score: number) => {
    // 서버 응답을 기다리는 동안에도 고른 별은 바로 보여 준다.
    rate(score);

    // 상담 정보가 남아 있지 않으면 서버에 매길 대상이 없다. 화면 흐름만 이어 간다.
    if (!ratingConsultationId || !userSessionId) {
      setRated(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await rateConsultation(ratingConsultationId, userSessionId, score);
      setRated(true);
    } catch (cause) {
      // 이미 평가한 상담이라면 점수는 남아 있다. 실패로 알릴 일이 아니다.
      if (cause instanceof ApiError && cause.code === 'CONSULTATION_ALREADY_RATED') {
        setRated(true);
        return;
      }
      setError(t('user.consultEnded.error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PhoneFrame layout="flush" bodyClassName={styles.body}>
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
          <div className={styles.dialog} role="dialog" aria-label={t('user.consultEnded.title')}>
            <div className={styles.mark}>
              <Icon name="chat" size={28} />
            </div>
            <h2 className={styles.heading}>{t('user.consultEnded.title')}</h2>
            <Sub center className={styles.lede}>
              {t('user.consultEnded.description')}
            </Sub>

            <div className={styles.stars}>
              {STARS.map((score) => (
                <button
                  key={score}
                  type="button"
                  className={styles.star}
                  style={{ color: score <= satisfaction ? '#F0B36A' : '#CFE2D5' }}
                  aria-label={t('user.consultEnded.score', { score })}
                  /* 한 번 평가한 뒤에는 잠근다. 다음 화면으로 넘어가는 타이머가 도는 동안 다른 별을 다시 눌러 평가를 덮어쓰지 못하게 한다. */
                  disabled={submitting || rated}
                  onClick={() => void submitRating(score)}
                >
                  ★
                </button>
              ))}
            </div>

            {satisfaction > 0 && !error && (
              <p className={styles.ratingLabel}>
                {i18n.resolvedLanguage === 'en'
                  ? t(`user.consultEnded.rating${satisfaction}`)
                  : SATISFACTION_LABELS[satisfaction]}
              </p>
            )}
            {error && (
              <p className={styles.ratingError} role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </>
    </PhoneFrame>
  );
}
