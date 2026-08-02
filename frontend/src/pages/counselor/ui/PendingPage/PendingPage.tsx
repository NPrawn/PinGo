import { useState } from 'react';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { ButtonLink } from '@/shared/ui';
import styles from './PendingPage.module.css';

/** Details of the submitted request. TODO: read from the sign-up response. */
const SUMMARY = [
  { label: '신청 계정', value: 'choi@pingo.kr' },
  { label: '담당 희망 역', value: '역삼역' },
];

/** `오늘 09:12` for the moment the page was opened. */
function formatRequestedAt() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  return `오늘 ${hour}:${minute}`;
}

/** Screen 27-2 — waiting for an admin to approve the account. */
export function PendingPage() {
  const [requestedAt] = useState(formatRequestedAt);

  return (
    <div className={styles.stage}>
      <div className={styles.card}>
        <div className={styles.mark}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8A6412"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.2 2" />
          </svg>
        </div>
        <h2 className={styles.heading}>승인을 기다리고 있어요</h2>
        <p className={styles.body}>
          관리자가 계정을 확인하는 중이에요. 승인되면 등록하신 이메일로 알려드릴게요.
        </p>

        <div className={styles.summary}>
          {SUMMARY.map((row) => (
            <div key={row.label} className={styles.row}>
              <span className={styles.rowLabel}>{row.label}</span>
              <span className={styles.rowValue}>{row.value}</span>
            </div>
          ))}
          <div className={styles.row}>
            <span className={styles.rowLabel}>신청 시각</span>
            <span className={styles.rowValue}>{requestedAt}</span>
          </div>
        </div>

        <div className={styles.eta}>
          <span className={styles.etaDot} aria-hidden />
          <span className={styles.etaText}>평균 승인 소요 · 2시간 이내</span>
        </div>

        <ButtonLink
          to={COUNSELOR_ROUTES.LOGIN}
          variant="secondary"
          size="sm"
          className={styles.action}
        >
          로그인 화면으로
        </ButtonLink>
      </div>
    </div>
  );
}
