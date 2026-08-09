import styles from './PagerDots.module.css';

type PagerDotsProps = {
  count: number;
  current: number;
};

export function PagerDots({ count, current }: PagerDotsProps) {
  return (
    <div className={styles.dots} aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className={[styles.dot, index === current && styles.on].filter(Boolean).join(' ')}
        />
      ))}
    </div>
  );
}
