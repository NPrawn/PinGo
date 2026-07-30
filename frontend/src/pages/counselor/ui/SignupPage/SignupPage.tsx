import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkLoginId, useSignup } from '@/features/console-auth';
import { ApiError } from '@/shared/api';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { BackLink, Button, DesktopWindow, Field } from '@/shared/ui';
import styles from './SignupPage.module.css';

export function SignupPage() {
  const navigate = useNavigate();
  const signup = useSignup();
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [stationId, setStationId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loginIdMessage, setLoginIdMessage] = useState('');

  async function validateLoginId() {
    const normalizedLoginId = loginId.trim();
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(normalizedLoginId)) {
      setLoginIdMessage('영문·숫자·밑줄 4~20자로 입력해 주세요.');
      return false;
    }

    try {
      const available = await checkLoginId(normalizedLoginId);
      setLoginIdMessage(available ? '사용 가능한 아이디예요.' : '이미 사용 중인 아이디예요.');
      return available;
    } catch (error) {
      setLoginIdMessage(
        error instanceof ApiError ? error.message : '아이디 중복 확인에 실패했습니다.',
      );
      return false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    const parsedStationId = Number(stationId);
    if (!name.trim() || !loginId.trim() || !password || !Number.isInteger(parsedStationId)) {
      setErrorMessage('이름, 아이디, 비밀번호, 역 ID를 모두 확인해 주세요.');
      return;
    }

    if (!(await validateLoginId())) return;

    try {
      await signup.mutateAsync({
        loginId: loginId.trim(),
        password,
        name: name.trim(),
        stationId: parsedStationId,
      });
      void navigate(COUNSELOR_ROUTES.PENDING);
    } catch (error) {
      setErrorMessage(
        error instanceof ApiError ? error.message : '가입 신청 중 문제가 발생했습니다.',
      );
    }
  }

  return (
    <DesktopWindow url="console.pingo.kr/signup" secure width={560}>
      <div className={styles.stage}>
        <form className={styles.card} onSubmit={handleSubmit}>
          <div className={styles.back}>
            <BackLink to={COUNSELOR_ROUTES.LOGIN}>로그인으로</BackLink>
          </div>
          <h2 className={styles.heading}>회원가입</h2>
          <p className={styles.lede}>상담자·관리자 계정을 신청해요</p>

          <label className={styles.label} htmlFor="signup-name">
            이름
          </label>
          <Field
            id="signup-name"
            className={styles.field}
            placeholder="이름"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <label className={styles.label} htmlFor="signup-id">
            아이디
          </label>
          <Field
            id="signup-id"
            className={styles.field}
            placeholder="아이디"
            value={loginId}
            onChange={(event) => {
              setLoginId(event.target.value);
              setLoginIdMessage('');
            }}
            onBlur={() => void validateLoginId()}
            required
          />
          {loginIdMessage && <p className={styles.fieldMessage}>{loginIdMessage}</p>}

          <label className={styles.label} htmlFor="signup-pw">
            비밀번호
          </label>
          <Field
            id="signup-pw"
            className={styles.field}
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <label className={styles.label} htmlFor="signup-station">
            담당 역 ID
          </label>
          <Field
            id="signup-station"
            className={styles.field}
            type="number"
            min={1}
            placeholder="예: 1"
            value={stationId}
            onChange={(event) => setStationId(event.target.value)}
            required
          />

          {errorMessage && (
            <p className={styles.error} role="alert">
              {errorMessage}
            </p>
          )}

          <Button type="submit" className={styles.submit} disabled={signup.isPending}>
            {signup.isPending ? '신청 중…' : '가입 신청하기'}
          </Button>
        </form>
      </div>
    </DesktopWindow>
  );
}
