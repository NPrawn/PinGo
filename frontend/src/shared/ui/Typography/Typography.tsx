import type { HTMLAttributes } from 'react';
import styles from './Typography.module.css';

type TextProps = HTMLAttributes<HTMLParagraphElement> & { center?: boolean };

type TitleProps = HTMLAttributes<HTMLHeadingElement> & {
  center?: boolean;
  /** Heading level. Screens use `h1`; sections inside them use `h2`. */
  as?: 'h1' | 'h2' | 'h3';
};

export function Title({ center, as: Tag = 'h1', className, ...props }: TitleProps) {
  return (
    <Tag
      className={[styles.title, center && styles.center, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

export function Sub({ center, className, ...props }: TextProps) {
  return (
    <p
      className={[styles.sub, center && styles.center, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

/** Small uppercase-ish label above a title. */
export function Kicker({ center, className, ...props }: TextProps) {
  return (
    <p
      className={[styles.kick, center && styles.center, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

/** Flexible spacer that pushes the following content to the bottom of a screen. */
export function Spring() {
  return <div className={styles.spring} />;
}
