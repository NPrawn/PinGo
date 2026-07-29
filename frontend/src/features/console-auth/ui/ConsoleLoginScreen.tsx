import { DesktopWindow } from '@/shared/ui';
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
    <DesktopWindow url="console.pingo.kr" secure width={560}>
      <div className={styles.stage}>
        <LoginForm />
      </div>
    </DesktopWindow>
  );
}
