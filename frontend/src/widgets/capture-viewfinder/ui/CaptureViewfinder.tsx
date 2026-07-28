import { Link } from 'react-router-dom';
import styles from './CaptureViewfinder.module.css';

export type CaptureDirection = {
  label: string;
  state: 'done' | 'current' | 'todo';
};

type CaptureProgressProps = {
  directions: readonly CaptureDirection[];
};

const barClass: Record<CaptureDirection['state'], string> = {
  done: styles.barDone,
  current: styles.barCurrent,
  todo: styles.barTodo,
};

/** Four-direction rotation progress shown at the bottom of both capture screens. */
export function CaptureProgress({ directions }: CaptureProgressProps) {
  const done = directions.filter((d) => d.state === 'done').length;

  return (
    <>
      <div className={styles.progressHead}>
        <span className={styles.progressTitle}>회전 진행</span>
        <span className={styles.progressCount}>
          {done} / {directions.length} 방향
        </span>
      </div>
      <div className={styles.progress}>
        {directions.map((direction) => (
          <div key={direction.label} className={styles.step}>
            <span className={`${styles.bar} ${barClass[direction.state]}`} />
            <span
              className={[styles.stepLabel, direction.state === 'todo' && styles.stepLabelTodo]
                .filter(Boolean)
                .join(' ')}
            >
              {direction.label}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

type RecordingBadgeProps = {
  label: string;
};

/** The pulsing REC chip. */
export function RecordingBadge({ label }: RecordingBadgeProps) {
  return (
    <span className={styles.recBadge}>
      <span className={styles.recDot} aria-hidden />
      <span className={styles.recLabel}>{label}</span>
    </span>
  );
}

type ViewfinderBackProps = {
  to: string;
};

/** Circular back control over the dark viewfinder. */
export function ViewfinderBack({ to }: ViewfinderBackProps) {
  return (
    <Link to={to} className={styles.backButton} aria-label="촬영 안내로 돌아가기">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#DFF6E6"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </Link>
  );
}
