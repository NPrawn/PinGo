import type { ReactNode } from 'react';
import styles from './PhoneFrame.module.css';

export type PhoneBodyLayout = 'default' | 'flush' | 'hero';

type PhoneFrameProps = {
  children: ReactNode;
  /** Dark device shell — camera, navigation and call screens. */
  dark?: boolean;
  /**
   * `flush` removes body padding for full-bleed screens (prototype `.body.p0`),
   * `hero` uses the roomier intro layout (prototype `.body-hero`).
   */
  layout?: PhoneBodyLayout;
  /**
   * Extra class on the body element. Screens use it for their own `.body`
   * overrides, matching how the prototype styled `.body` per screen.
   *
   * Absolutely positioned children resolve against the phone shell, not the
   * body, because the shell is the positioned ancestor — same as the prototype.
   */
  bodyClassName?: string;
  /** Extra class on the phone shell, used by camera-backed screens. */
  phoneClassName?: string;
  /** Keep the empty area formerly occupied by the mock device status bar. */
  reserveTopSpace?: boolean;
  /** Content layered over the whole shell, e.g. modals and toasts. */
  overlay?: ReactNode;
};

const layoutClass: Record<PhoneBodyLayout, string | undefined> = {
  default: undefined,
  flush: styles.flush,
  hero: styles.hero,
};

/**
 * The phone device shell every user-facing screen renders inside.
 *
 * Replaces the prototype's `.scr > .phone` markup, which was repeated verbatim
 * on all 26 user screens.
 */
export function PhoneFrame({
  children,
  dark,
  layout = 'default',
  bodyClassName,
  phoneClassName,
  reserveTopSpace = true,
  overlay,
}: PhoneFrameProps) {
  return (
    <div className={styles.stage}>
      <div
        className={[styles.phone, dark && styles.dark, phoneClassName].filter(Boolean).join(' ')}
      >
        {reserveTopSpace && <div className={styles.statusBarSpace} aria-hidden />}
        <div
          className={[styles.body, layoutClass[layout], bodyClassName].filter(Boolean).join(' ')}
        >
          {children}
        </div>
        {overlay}
      </div>
    </div>
  );
}
