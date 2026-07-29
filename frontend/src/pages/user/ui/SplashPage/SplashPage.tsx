import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, Icon } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './SplashPage.module.css';

/** Screen 01 — intro animation with a three-scene feature preview. */
export function SplashPage() {
  return (
    <PhoneFrame dark layout="flush">
      <>
        <div className={styles.logo}>
          <span className={styles.logoMark}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#fff" aria-hidden>
              <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
            </svg>
          </span>
          <span className={styles.logoText}>PinGo</span>
        </div>

        <div className={styles.scenes}>
          <div className={styles.scene} style={{ animationDelay: '0s' }}>
            <div className={styles.mapCard}>
              <svg viewBox="0 0 230 180" className={styles.mapSvg} aria-hidden>
                <rect
                  x="18"
                  y="18"
                  width="194"
                  height="144"
                  rx="10"
                  fill="#26262e"
                  stroke="#33333c"
                  strokeWidth="2"
                />
                <path
                  d="M50 140 V80 H150 V44"
                  fill="none"
                  stroke="#33333c"
                  strokeWidth="20"
                  strokeLinejoin="round"
                />
                <path
                  d="M50 140 V80 H150 V50"
                  fill="none"
                  stroke="#3EB489"
                  strokeWidth="4"
                  strokeDasharray="2 9"
                  strokeLinecap="round"
                />
              </svg>
              <div className={styles.mapDest} />
              <div className={styles.walker}>
                <svg width="26" height="30" viewBox="0 0 26 30" fill="none" aria-hidden>
                  <circle cx="13" cy="6.5" r="5.5" fill="#3EB489" />
                  <path
                    d="M13 14c-4.4 0-7.5 3-7.5 7.2V27a2.5 2.5 0 002.5 2.5h1.6c1 0 1.8-.8 1.8-1.8v-3.4h3.2v3.4c0 1 .8 1.8 1.8 1.8H18a2.5 2.5 0 002.5-2.5v-5.8C20.5 17 17.4 14 13 14z"
                    fill="#3EB489"
                  />
                </svg>
              </div>
              <div className={styles.mapQuestion}>
                <Icon name="question" size={26} />
              </div>
            </div>
            <div className={styles.sceneTitle}>
              지하철에서도
              <br />
              길찾기가 필요했나요?
            </div>
            <div className={styles.sceneBody}>
              복잡한 역 안, GPS가 안 통하는 실내에서
              <br />
              PinGo가 출구까지 안내해요.
            </div>
          </div>

          <div className={styles.scene} style={{ animationDelay: '-4s' }}>
            <div className={styles.phoneMock}>
              <div className={styles.phoneMockLens} />
              <div className={styles.phoneMockArrow}>↑</div>
              <div className={styles.phoneMockCaption}>3번 출구까지 직진</div>
            </div>
            <div className={styles.sceneTitle}>
              카메라를 비추면
              <br />
              화살표로 안내해요
            </div>
            <div className={styles.sceneBody}>
              주변을 촬영하면 현재 위치를 찾고,
              <br />
              가야 할 방향을 실시간으로 알려줘요.
            </div>
          </div>

          <div className={styles.scene} style={{ animationDelay: '-8s' }}>
            <div className={styles.chat}>
              <div className={styles.chatInner}>
                <div className={styles.chatRow}>
                  <span className={styles.chatAvatar}>
                    <Icon name="person" size={22} />
                  </span>
                  <span className={styles.chatBubbleUser}>Where is exit 3?</span>
                </div>
                <div className={styles.chatStatus}>
                  <span className={styles.chatSpinner} />
                  실시간 번역 중…
                </div>
                <div className={`${styles.chatRow} ${styles.chatRowAgent}`}>
                  <span className={styles.chatBubbleAgent}>왼쪽 엘리베이터로 안내할게요</span>
                  <span className={styles.chatAvatar}>
                    <Icon name="headset" size={22} />
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.sceneTitle}>
              언어가 통하지 않아도
              <br />
              쉽게 상담할 수 있어요
            </div>
            <div className={styles.sceneBody}>
              화면·음성을 공유하면 상담원이
              <br />
              번역과 함께 길을 안내해줘요.
            </div>
          </div>
        </div>

        <div className={styles.dots} aria-hidden>
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>

        <div className={styles.action}>
          <ButtonLink to={USER_ROUTES.LANGUAGE}>시작하기</ButtonLink>
        </div>
      </>
    </PhoneFrame>
  );
}
