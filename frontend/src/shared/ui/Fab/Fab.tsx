import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import styles from './Fab.module.css';

type FabLinkProps = {
  to: string;
  label: string;
  children: ReactNode;
};

export function FabLink({ to, label, children }: FabLinkProps) {
  return (
    <Link to={to} className={styles.fab} aria-label={label}>
      {children}
    </Link>
  );
}
