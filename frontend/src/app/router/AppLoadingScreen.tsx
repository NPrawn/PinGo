import styles from './AppLoadingScreen.module.css';

/** 지연 로드된 라우트 청크가 준비되는 동안 보여 주는 전역 fallback. */
export function AppLoadingScreen() {
  return (
    <main className={styles.screen} aria-label="PinGo 페이지 준비" aria-busy="true">
      <span className={styles.spinner} aria-hidden="true" />
      <span className={styles.srOnly} role="status" aria-live="polite">
        페이지를 준비하고 있습니다.
      </span>
    </main>
  );
}
