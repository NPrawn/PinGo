import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import styles from './MapControls.module.css';

type FloorRailProps = {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
};

/** Prototype `.frail` / `.frb` — the vertical floor switcher beside a map. */
export function FloorRail({ options, value, onChange, label = '층 선택' }: FloorRailProps) {
  return (
    <div className={styles.rail} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          className={[styles.railButton, option.value === value && styles.railButtonOn]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

type MapToggleProps = ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean };

/** Prototype `.factog` — a compact pill toggle floated over a map. */
export function MapToggle({ on, className, type = 'button', ...props }: MapToggleProps) {
  return (
    <button
      type={type}
      aria-pressed={on}
      className={[styles.toggle, on && styles.toggleOn, className].filter(Boolean).join(' ')}
      {...props}
    />
  );
}

type FacilityPinProps = {
  x: string;
  y: string;
  tint: string;
  label: string;
  icon: ReactNode;
  /** Highlighted after the counselor points it out to the user. */
  blink?: boolean;
};

/** Prototype `.facpin` — a facility marker with a caption. */
export function FacilityPin({ x, y, tint, label, icon, blink }: FacilityPinProps) {
  return (
    <div
      className={[styles.pin, blink && styles.pinBlink].filter(Boolean).join(' ')}
      style={{ left: x, top: y }}
    >
      <span className={styles.pinIcon} style={{ color: tint, borderColor: tint }}>
        {icon}
      </span>
      <span className={styles.pinLabel}>{label}</span>
    </div>
  );
}

type HeadingMarkerProps = {
  style?: CSSProperties;
};

/** Prototype `.heading` — the user's position with a sweeping direction beam. */
export function HeadingMarker({ style }: HeadingMarkerProps) {
  return (
    <div className={styles.heading} style={style} aria-hidden>
      <span className={styles.beam} />
      <span className={styles.ping} />
      <span className={styles.headingDot} />
    </div>
  );
}
