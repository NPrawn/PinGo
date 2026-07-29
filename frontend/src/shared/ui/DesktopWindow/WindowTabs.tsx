import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { IconName } from '../Icon';
import { Icon } from '../Icon';
import styles from './DesktopWindow.module.css';

export type WindowTab = {
  to: string;
  label: string;
  icon?: IconName;
};

type WindowTabsProps = {
  tabs: readonly WindowTab[];
  label: string;
  /** Right-aligned content in the same strip, e.g. a logout link. */
  trailing?: ReactNode;
};

/** Prototype `.wtabs` — the browser-style tab strip inside a `DesktopWindow`. */
export function WindowTabs({ tabs, label, trailing }: WindowTabsProps) {
  return (
    <nav className={styles.tabs} aria-label={label}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            [styles.tab, isActive && styles.tabOn].filter(Boolean).join(' ')
          }
        >
          {tab.icon && <Icon name={tab.icon} size={16} />}
          {tab.label}
        </NavLink>
      ))}
      {trailing}
    </nav>
  );
}
