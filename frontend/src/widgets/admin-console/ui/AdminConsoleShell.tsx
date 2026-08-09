import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { AdminTab } from '@/shared/config';
import { ADMIN_ROUTES, COUNSELOR_ROUTES } from '@/shared/config';
import { Icon } from '@/shared/ui';
import { ADMIN_NAV } from '../model/adminNav';
import styles from './AdminConsoleShell.module.css';

type AdminConsoleShellProps = {
  activeTab: AdminTab;
  children: ReactNode;
};

/**
 * 관리자 콘솔의 골격: 사이드바와 본문 영역.
 *
 * 프로토타입은 가짜 브라우저 창(DesktopWindow) 안에 콘솔을 넣어 보여줬다. 실제 웹사이트로
 * 배포하므로 그 테두리를 걷어내고 화면 전체를 쓴다. 사이드바는 붙어 있고 본문만 스크롤한다.
 */
export function AdminConsoleShell({ activeTab, children }: AdminConsoleShellProps) {
  return (
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
      <main className={styles.content}>
        {/* 초광폭 화면에서 표가 끝까지 늘어나지 않도록 본문 폭을 제한한다. */}
        <div className={styles.inner}>{children}</div>
      </main>
    </div>
  );
}
