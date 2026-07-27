import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { AdminTab } from '@/shared/config';
import { ADMIN_ROUTES, COUNSELOR_ROUTES } from '@/shared/config';
import { DesktopWindow, Icon } from '@/shared/ui';
import { ADMIN_NAV } from '../model/adminNav';
import styles from './AdminConsoleShell.module.css';

type AdminConsoleShellProps = {
  activeTab: AdminTab;
  children: ReactNode;
};

/**
 * Chrome for the admin console: browser window, sidebar navigation and the
 * scrollable content area every tab renders into.
 */
export function AdminConsoleShell({ activeTab, children }: AdminConsoleShellProps) {
  return (
    <DesktopWindow url="admin.pingo.kr" width={1180}>
      <div className={styles.layout}>
        <div className={styles.aside}>
          <div className={styles.brand}>
            <Icon name="gear" size={17} />
            PinGo Admin
          </div>
          <nav aria-label="관리자 메뉴">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.tab}
                to={`${ADMIN_ROUTES.CONSOLE}/${item.tab}`}
                className={[styles.nav, item.tab === activeTab && styles.navOn]
                  .filter(Boolean)
                  .join(' ')}
                aria-current={item.tab === activeTab ? 'page' : undefined}
              >
                <span className={styles.navIcon} style={{ color: item.tint }}>
                  <Icon name={item.icon} size={16} />
                </span>
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Pinned to the bottom of the rail, away from the navigation. */}
          <Link to={COUNSELOR_ROUTES.LOGIN} className={styles.logout}>
            <span className={styles.logoutIcon}>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M9.5 20H6a2 2 0 01-2-2V6a2 2 0 012-2h3.5" />
                <path d="M15 16l4-4-4-4" />
                <path d="M19 12H9.5" />
              </svg>
            </span>
            로그아웃
          </Link>
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </DesktopWindow>
  );
}
