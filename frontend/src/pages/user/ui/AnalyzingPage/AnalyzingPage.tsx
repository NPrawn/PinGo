import { USER_ROUTES } from '@/shared/config';
import { ButtonLink, GhostLink, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './AnalyzingPage.module.css';

/**
 * Screen 06 — matching the captured images against the VPS.
 *
 * The prototype overlaid a red "보류 예정" banner here; that is a design-review
 * annotation about scope, not product UI, so it is not carried over.
 *
 * TODO: Drive the outcome from the real VPS response instead of the two manual
 * shortcuts below, which exist so the flow stays walkable without a backend.
 */
export function AnalyzingPage() {
  return (
    <PhoneFrame dark bodyClassName={styles.body}>
      <>
        <div className={styles.spinner} aria-hidden />
        <Title className={styles.title}>분석 중이에요…</Title>
        <Sub className={styles.sub}>주변 이미지를 서버 VPS와 대조하고 있어요</Sub>
        <div className={styles.shortcuts}>
          <ButtonLink
            to={USER_ROUTES.LOCATE_FAILED}
            variant="secondary"
            className={styles.altButton}
          >
            인식 실패 화면 보기
          </ButtonLink>
          <GhostLink to={USER_ROUTES.LOCATE_SUCCESS} className={styles.altLink}>
            바로 성공 화면 보기 →
          </GhostLink>
        </div>
      </>
    </PhoneFrame>
  );
}
