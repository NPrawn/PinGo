import { COUNSELOR_ROUTES } from '@/shared/config';
import { BackLink, ButtonLink, DesktopWindow, Field } from '@/shared/ui';
import styles from './SignupPage.module.css';

/**
 * Screen 27-1 — account request.
 *
 * TODO: Wire to the sign-up endpoint and add validation once the account
 * contract (required fields, role approval flow) is agreed. The prototype's
 * fields were unbound.
 */
export function SignupPage() {
  return (
    <DesktopWindow url="console.pingo.kr/signup" secure width={560}>
      <div className={styles.stage}>
        <div className={styles.card}>
          <div className={styles.back}>
            <BackLink to={COUNSELOR_ROUTES.LOGIN}>로그인으로</BackLink>
          </div>
          <h2 className={styles.heading}>회원가입</h2>
          <p className={styles.lede}>상담자·관리자 계정을 신청해요</p>

          <label className={styles.label} htmlFor="signup-name">
            이름
          </label>
          <Field id="signup-name" className={styles.field} placeholder="이름" />

          <label className={styles.label} htmlFor="signup-id">
            아이디
          </label>
          <Field id="signup-id" className={styles.field} placeholder="아이디" />

          <label className={styles.label} htmlFor="signup-pw">
            비밀번호
          </label>
          <Field id="signup-pw" className={styles.field} type="password" placeholder="비밀번호" />

          <ButtonLink to={COUNSELOR_ROUTES.PENDING} className={styles.submit}>
            가입 신청하기
          </ButtonLink>
        </div>
      </div>
    </DesktopWindow>
  );
}
