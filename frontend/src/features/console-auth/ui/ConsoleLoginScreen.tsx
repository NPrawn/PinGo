import { ROUTES } from '@/shared/config';
import { BackLink } from '@/shared/ui';
import { LoginForm } from './LoginForm';
import styles from './ConsoleLoginScreen.module.css';

/**
 * The full console sign-in screen.
 *
 * Both the counselor and admin sections start here, and the entered credentials
 * decide which console the user lands in — so the screen lives in the feature
 * rather than in either page.
 */
export function ConsoleLoginScreen() {
  return (
    <div className={styles.stage}>
      {/* 로그인 창이 페이지가 되면서 닫기 수단이 없어졌으므로 홈으로 나갈 길을 둔다. */}
      <div className={styles.back}>
        <BackLink to={ROUTES.HOME}>처음으로</BackLink>
      </div>
      <LoginForm />
    </div>
  );
}
