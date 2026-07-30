import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADMIN_ROUTES, COUNSELOR_ROUTES } from '@/shared/config';
import { ApiError, setAuthSession } from '@/shared/api';
import { Blob, Button, Field } from '@/shared/ui';
import { useLogin } from '../api/useAuthMutations';
import styles from './LoginForm.module.css';

/**
 * Combined counselor/admin sign-in.
 *
 * Uses the shared backend login endpoint and routes by the returned account type.
 */
export function LoginForm() {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const submit = () => {
    if (!id.trim() || !pw) {
      setErrorMessage('아이디와 비밀번호를 입력해 주세요.');
      return;
    }

    setErrorMessage('');
    loginMutation.mutate(
      { loginId: id.trim(), password: pw },
      {
        onSuccess: (account) => {
          setAuthSession({
            accessToken: account.accessToken,
            accountType: account.accountType,
            accountId: account.accountId,
            name: account.name,
            stationId: account.stationId ?? undefined,
            status: account.status ?? undefined,
          });

          void navigate(
            account.accountType === 'ADMIN' ? ADMIN_ROUTES.CONSOLE : COUNSELOR_ROUTES.REQUESTS,
          );
        },
        onError: (error) => {
          setErrorMessage(
            error instanceof ApiError ? error.message : '로그인 중 오류가 발생했습니다.',
          );
        },
      },
    );
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
            setErrorMessage('');
          }}
        />
        <Field
          type="password"
          placeholder="비밀번호"
          value={pw}
          aria-label="비밀번호"
          onChange={(event) => {
            setPw(event.target.value);
            setErrorMessage('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit();
          }}
        />
        {errorMessage && <p className={styles.error}>{errorMessage}</p>}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => void navigate(COUNSELOR_ROUTES.SIGNUP)}>
            회원가입
          </Button>
          <Button onClick={submit} disabled={loginMutation.isPending}>
            {loginMutation.isPending ? '로그인 중...' : '로그인'}
          </Button>
        </div>
      </div>
    </div>
  );
}
