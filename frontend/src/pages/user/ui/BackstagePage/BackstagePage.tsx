import { Link } from 'react-router-dom';
import { USER_ROUTES } from '@/shared/config';
import styles from './BackstagePage.module.css';

const SCENARIOS = [
  { to: USER_ROUTES.ROUTE_OPTIONS, label: '경로 변경' },
  { to: USER_ROUTES.NAVIGATION_REROUTE, label: '경로 이탈' },
  { to: USER_ROUTES.OFFLINE, label: '연결 끊김' },
] as const;

/** Development-only entry points for checking navigation exception screens. */
export function BackstagePage() {
  return (
    <main className={styles.page}>
      <nav className={styles.actions} aria-label="내비게이션 상황 확인">
        {SCENARIOS.map((scenario) => (
          <Link key={scenario.to} to={scenario.to} className={styles.action}>
            {scenario.label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
