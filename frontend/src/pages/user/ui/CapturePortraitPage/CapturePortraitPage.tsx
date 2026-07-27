import { Link } from 'react-router-dom';
import { USER_ROUTES } from '@/shared/config';
import { ButtonLink } from '@/shared/ui';
import { CaptureProgress, RecordingBadge, ViewfinderBack } from '@/widgets/capture-viewfinder';
import type { CaptureDirection } from '@/widgets/capture-viewfinder';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './CapturePortraitPage.module.css';

/** TODO: Drive from real capture progress once the camera pipeline exists. */
const DIRECTIONS: readonly CaptureDirection[] = [
  { label: '정면', state: 'done' },
  { label: '오른쪽', state: 'done' },
  { label: '뒤쪽', state: 'current' },
  { label: '왼쪽', state: 'todo' },
];

/**
 * Screen 05a (FR-U-004) — full-screen portrait capture.
 *
 * TODO: Replace the SVG scene with the live camera stream after checking
 * `getUserMedia` support and providing the agreed fallback.
 */
export function CapturePortraitPage() {
  return (
    <PhoneFrame layout="flush" bodyClassName={styles.body} statusBarClassName={styles.statusBar}>
      <>
        <svg viewBox="0 0 300 640" preserveAspectRatio="none" className={styles.scene} aria-hidden>
          <path d="M0 640 L117 320 H183 L300 640 Z" fill="rgba(60,216,160,0.07)" />
          <path
            d="M0 640 L117 320 M300 640 L183 320 M117 320 H183"
            stroke="rgba(127,239,195,0.24)"
            strokeWidth="1.2"
            fill="none"
          />
          <path
            d="M117 320 V128 H183 V320"
            stroke="rgba(127,239,195,0.16)"
            strokeWidth="1.2"
            fill="none"
          />
          <rect x="129" y="172.8" width="42" height="51.2" rx="3" fill="rgba(127,239,195,0.2)" />
          <path
            d="M0 512 H90 M210 512 H300"
            stroke="rgba(127,239,195,0.12)"
            strokeWidth="1"
            fill="none"
          />
        </svg>

        <div className={styles.band} aria-hidden />
        <div className={styles.horizon} aria-hidden />
        <div className={styles.cornerLeft} aria-hidden />
        <div className={styles.cornerRight} aria-hidden />

        <div className={styles.topBar}>
          <ViewfinderBack to={USER_ROUTES.CAPTURE_GUIDE} />
          <RecordingBadge label="REC · 세로" />
          <span className={styles.topBarSpacer} />
        </div>

        <div className={styles.hint}>
          <span className={styles.hintText}>천천히 오른쪽으로</span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7FEFC3"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={styles.hintArrow}
            aria-hidden
          >
            <path d="M5 12h13M13 6l6 6-6 6" />
          </svg>
        </div>

        <Link to={USER_ROUTES.CAPTURE_LANDSCAPE} className={styles.rotateTip}>
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#7FEFC3"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flex: 'none' }}
            aria-hidden
          >
            <rect x="2" y="7" width="20" height="14" rx="3" />
            <path d="M16 3.5a7 7 0 00-6.5-1" />
            <path d="M9 1.5v2.6h2.6" />
          </svg>
          <span className={styles.rotateTipText}>
            기기를 <b>가로로 돌리면</b> 한 번에 2배 넓게 담겨요
          </span>
          <span className={styles.rotateTipAction}>전환</span>
        </Link>

        <div className={styles.dock}>
          <CaptureProgress directions={DIRECTIONS} />
          <ButtonLink to={USER_ROUTES.ANALYZING} className={styles.finish}>
            촬영 완료 · 위치 찾기
          </ButtonLink>
        </div>
      </>
    </PhoneFrame>
  );
}
