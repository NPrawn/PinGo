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
    <DesktopWindow
      url="admin.pingo.kr"
      width={1180}
      barExtra={
        <Link to={COUNSELOR_ROUTES.LOGIN} className={styles.logout}>
          로그아웃
        </Link>
      }
    >
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
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </DesktopWindow>
  );
}
