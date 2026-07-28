import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { Blob, Button, Field } from '@/shared/ui';
import { authenticate } from '../model/demoAccounts';
import styles from './LoginForm.module.css';

/**
 * Combined counselor/admin sign-in.
 *
 * The prototype routed by credential; that behaviour is preserved, but no
 * session is stored — see the TODO on `DEMO_ACCOUNTS`.
 */
export function LoginForm() {
  const navigate = useNavigate();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [failed, setFailed] = useState(false);

  const submit = () => {
    const account = authenticate(id, pw);
    if (!account) {
      setFailed(true);
      return;
    }
    void navigate(account.landing);
  };

  const fill = (nextId: string) => {
    setId(nextId);
    setPw('1234');
    setFailed(false);
  };

  return (
    <div className={styles.card}>
      <Blob
        style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 130,
          height: 130,
          opacity: 0.35,
        }}
      />
      <Blob
        tone="lilac"
        style={{
          position: 'absolute',
          bottom: -30,
          left: -30,
          width: 80,
          height: 80,
          opacity: 0.3,
        }}
      />
      <div className={styles.inner}>
        <div className={styles.mark}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
          </svg>
        </div>
        <h2 className={styles.heading}>PinGo 콘솔 로그인</h2>
        <p className={styles.lede}>계정에 따라 상담자 또는 관리자 화면으로 이동해요</p>

        <Field
          className={styles.idField}
          placeholder="아이디"
          value={id}
          aria-label="아이디"
          onChange={(event) => {
            setId(event.target.value);
            setFailed(false);
          }}
        />
        <Field
          type="password"
          placeholder="비밀번호"
          value={pw}
          aria-label="비밀번호"
          onChange={(event) => {
            setPw(event.target.value);
            setFailed(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
        />
        {failed && <p className={styles.error}>아이디와 비밀번호를 확인해 주세요.</p>}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => void navigate(COUNSELOR_ROUTES.SIGNUP)}>
            회원가입
          </Button>
          <Button onClick={submit}>로그인</Button>
        </div>

        <div className={styles.demo}>
          <b className={styles.demoTitle}>데모 계정</b>
          <br />
          상담자 →{' '}
          <button type="button" className={styles.demoFill} onClick={() => fill('counselor')}>
            counselor / 1234
          </button>
          <br />
          관리자 →{' '}
          <button type="button" className={styles.demoFill} onClick={() => fill('admin')}>
            admin / 1234
          </button>
        </div>
      </div>
    </div>
  );
}
