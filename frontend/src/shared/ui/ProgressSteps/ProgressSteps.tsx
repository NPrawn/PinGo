import { Fragment } from 'react';
import styles from './ProgressSteps.module.css';

type ProgressStepsProps = {
  steps: readonly string[];
  /** Zero-based index of the step the user is on. */
  current: number;
  label?: string;
};

export function ProgressSteps({ steps, current, label = '진행 단계' }: ProgressStepsProps) {
  return (
    <div
      className={styles.progress}
      role="group"
      aria-label={`${label} · ${steps.length}단계 중 ${current + 1}단계`}
    >
      {steps.map((step, index) => (
        <Fragment key={step}>
          {index > 0 && <span className={styles.line} />}
          <span
            className={[
              styles.step,
              index === current && styles.current,
              index < current && styles.done,
            ]
              .filter(Boolean)
              .join(' ')}
            aria-current={index === current ? 'step' : undefined}
          >
            <span className={styles.dot} aria-hidden>
              {index < current ? '✓' : index + 1}
            </span>
            {step}
          </span>
        </Fragment>
      ))}
    </div>
  );
}
