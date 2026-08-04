import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { USER_ROUTES } from '@/shared/config';
import styles from './BackstagePage.module.css';

const SCENARIOS = [
  { to: USER_ROUTES.ROUTE_OPTIONS, labelKey: 'user.backstage.routeChange' },
  { to: USER_ROUTES.NAVIGATION_REROUTE, labelKey: 'user.backstage.reroute' },
  { to: USER_ROUTES.OFFLINE, labelKey: 'user.backstage.offline' },
] as const;

/** Development-only entry points for checking navigation exception screens. */
export function BackstagePage() {
  const { t } = useTranslation();

  return (
    <main className={styles.page}>
      <nav className={styles.actions} aria-label={t('user.backstage.label')}>
        {SCENARIOS.map((scenario) => (
          <Link key={scenario.to} to={scenario.to} className={styles.action}>
            {t(scenario.labelKey)}
          </Link>
        ))}
      </nav>
    </main>
  );
}
