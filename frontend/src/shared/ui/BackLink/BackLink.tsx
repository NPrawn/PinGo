import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import styles from './BackLink.module.css';

type BackLinkProps = {
  to?: string;
  onClick?: () => void;
  children: ReactNode;
};

export function BackLink({ to, onClick, children }: BackLinkProps) {
  const content = (
    <>
      <span className={styles.chevron}>
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="butt"
          strokeLinejoin="miter"
          aria-hidden
        >
          <path d="M14.8 4.6 7.4 12l7.4 7.4" />
        </svg>
      </span>
      {children}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={styles.back}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={styles.back} onClick={onClick}>
      {content}
    </button>
  );
}
