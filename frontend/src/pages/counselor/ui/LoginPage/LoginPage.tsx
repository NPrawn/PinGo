import { LoginForm } from '@/features/console-auth';
import { DesktopWindow } from '@/shared/ui';
import styles from './LoginPage.module.css';

/** Screen 27 — combined counselor/admin sign-in. */
export function LoginPage() {
  return (
    <DesktopWindow url="console.pingo.kr" secure width={560}>
      <div className={styles.stage}>
        <LoginForm />
      </div>
    </DesktopWindow>
  );
}
