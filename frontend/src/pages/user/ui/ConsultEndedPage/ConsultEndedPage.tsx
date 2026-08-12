import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SATISFACTION_LABELS, useConsultStore } from '@/entities/consult';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
import { releaseConsultMedia } from '@/features/consult-signaling';
import { ApiError, rateConsultation } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { Icon, MapPreview, Sub } from '@/shared/ui';
import { IndoorMapView } from '@/widgets/indoor-map';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ConsultEndedPage.module.css';

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
  const entryRoute = useConsultStore((state) => state.entryRoute);
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
   * 모달 뒤에 비치는 배경. **도면만 그린다. 현재 위치와 경로는 그리지 않는다.** (S15P11A206-382)
   *
   * 프로토타입 목업이 그대로 남아 있던 자리다 — 퍼센트로 고정한 가짜 내 위치·목적지 마커,
   * `['1F','B1','B2']` 로 박아 둔 층 버튼, 카메라 자리의 하드코딩 `↑` 화살표였다. 안내 화면은
   * 그 셋을 모두 걷어냈다(가짜 마커는 "표시가 둘이 되어 어느 쪽이 실제인지 구분할 수 없다",
   * 층 목록은 응답에서 만든다 — 역삼역에 `1F` 지도는 없다). 이 화면만 남아 있었다.
   *
   * **마커와 경로를 그리지 않는 이유.** 이 화면은 상담 화면이 보여 주던 것을 이어서 보여 줄
   * 수단이 없다. 상담 화면은 살아 있는 XR 세션의 좌표와 방향으로 시점을 사용자 진행 방향에
   * 맞춰 돌려 두는데, 여기서는 마운트 즉시 `releaseConsultMedia()` 로 세션을 놓기 때문에 그
   * 방향이 없다. 그러면 같은 좌표를 그려도 도면이 기본 회전으로 돌아가, 내 위치와 경로가 서로
   * 맞지 않는 것처럼 읽힌다. 틀린 자리를 그리는 것보다 그리지 않는 편이 낫다 — 모달 뒤에서
   * `brightness(0.8)` 로 어두워진 뒤 55% 검은 막까지 덮이는 배경이라 더 그렇다.
   *
   * 층은 그대로 쓴다. 어느 도면을 펼칠지는 위치가 아니라 "어디에 있었는지" 이고, 그것이 틀리면
   * 아예 다른 역·다른 층 그림이 뒤에 깔린다.
   */
  const stationId = useStationStore((state) => state.stationId);
  const trackedFloorId = useNavigationStore((state) => state.trackedFloorId);
  const currentFloorId = useNavigationStore((state) => state.currentFloorId);
  /** 상담 화면과 같은 우선순위다 — 걸어온 층이 있으면 그것, 없으면 확정 층. */
  const backdropFloorId = trackedFloorId ?? currentFloorId ?? undefined;

  /**
   * 상담이 끝나고 돌아갈 자리. (S15P11A206-89)
   *
   * **경로 안내에서 시작한 상담만 안내로 되돌린다.** 그 화면은 목적지와 경로를 이미 들고 있어
   * 돌아가면 걷던 자리에서 이어진다. 다른 화면에서 시작했다면 되돌릴 안내가 없으므로 역 선택으로
   * 간다 — 목적지도 경로도 없는 빈 안내 화면을 띄우면 사용자는 무엇이 잘못됐는지 알 수 없다.
   *
   * 위 `ratingConsultationId` 와 같은 이유로 마운트 시점 값에 고정한다. 아래 effect 가 store 를
   * 비우기 전의 값이어야 한다.
   */
  const [returnRoute] = useState<string>(() =>
    entryRoute === USER_ROUTES.NAVIGATION ? USER_ROUTES.NAVIGATION : USER_ROUTES.STATION,
  );

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
    const timer = setTimeout(() => void navigate(returnRoute), DISMISS_MS);
    return () => clearTimeout(timer);
  }, [rated, navigate, returnRoute]);

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
          {/* 카메라 자리. 영상은 이미 반납했으므로 비운다 — 가짜 화살표를 그리지 않는다. */}
          <div className={styles.cam} />
          <div className={styles.mapWrap}>
            {/* `MapPreview` 는 테두리 카드만 맡는다. 상담 화면과 같은 감싸기다. */}
            <MapPreview className={styles.map}>
              <div className={styles.mapCanvas}>
                {/* 층 도면만 넘긴다. 위치·방향·경로를 넘기지 않으므로 추종 시점도 켜지 않는다 —
                    따라갈 대상이 없으면 도면 전체가 상자에 맞춰 들어온다. */}
                <IndoorMapView stationId={stationId ?? 0} floorId={backdropFloorId} />
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
            {/* 어디로 가는지 그대로 적는다. 안내로 돌아가는데 목적지 검색이라고 쓰면
                걷던 사용자는 경로가 사라진 줄로 읽는다. */}
            <Sub center className={styles.lede}>
              {returnRoute === USER_ROUTES.NAVIGATION
                ? t('user.consultEnded.descriptionNavigation')
                : t('user.consultEnded.description')}
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
