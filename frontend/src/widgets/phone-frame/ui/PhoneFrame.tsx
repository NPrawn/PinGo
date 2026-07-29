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
  /** Extra class on the status bar — the capture screens darken it. */
  statusBarClassName?: string;
  /** Content layered over the whole shell, e.g. modals and toasts. */
  overlay?: ReactNode;
  /** Status-bar clock. The prototype hard-coded 9:41 on every screen. */
  time?: string;
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
  statusBarClassName,
  overlay,
  time = '9:41',
}: PhoneFrameProps) {
  return (
    <div className={styles.stage}>
      <div className={[styles.phone, dark && styles.dark].filter(Boolean).join(' ')}>
        <div
          className={[styles.statusBar, statusBarClassName].filter(Boolean).join(' ')}
          aria-hidden
        >
          <span>{time}</span>
          <span className={styles.statusBarRight}>●●● ▮</span>
        </div>
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
