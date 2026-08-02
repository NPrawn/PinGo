import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { checkLoginId, useSignup } from '@/features/console-auth';
import { ApiError, searchStations } from '@/shared/api';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { BackLink, Button, DesktopWindow, Field, PasswordField, SelectField } from '@/shared/ui';
import styles from './SignupPage.module.css';

/** Mirrors the server-side rule in `SignupRequest.password`. */
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,20}$/;
const PASSWORD_HINT = '영문·숫자·특수문자를 각각 포함해 8~20자로 입력해 주세요.';

export function SignupPage() {
  const navigate = useNavigate();
  const signup = useSignup();
  const [name, setName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [stationId, setStationId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loginIdMessage, setLoginIdMessage] = useState('');
  /** null before the id has been checked. */
  const [loginIdAvailable, setLoginIdAvailable] = useState<boolean | null>(null);
  const [passwordError, setPasswordError] = useState('');

  // 담당 역은 ID를 외울 수 없으니 서비스 중인 역 목록에서 고르게 한다.
  const stationsQuery = useQuery({
    queryKey: ['signup-stations'],
    queryFn: () => searchStations(),
  });
  const stations = stationsQuery.data ?? [];

  function validatePassword() {
    if (!PASSWORD_PATTERN.test(password)) {
      setPasswordError(PASSWORD_HINT);
      return false;
    }

    setPasswordError('');
    return true;
  }

  async function validateLoginId() {
    const normalizedLoginId = loginId.trim();
    if (!/^[a-zA-Z0-9_]{4,20}$/.test(normalizedLoginId)) {
      setLoginIdMessage('영문·숫자·밑줄 4~20자로 입력해 주세요.');
      setLoginIdAvailable(false);
      return false;
    }

    try {
      const available = await checkLoginId(normalizedLoginId);
      setLoginIdMessage(available ? '사용 가능한 아이디예요.' : '이미 사용 중인 아이디예요.');
      setLoginIdAvailable(available);
      return available;
    } catch (error) {
      setLoginIdMessage(
        error instanceof ApiError ? error.message : '아이디 중복 확인에 실패했습니다.',
      );
      setLoginIdAvailable(false);
      return false;
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');

    const parsedStationId = Number(stationId);
    if (!name.trim() || !loginId.trim() || !password || !Number.isInteger(parsedStationId)) {
      setErrorMessage('이름, 아이디, 비밀번호, 담당 역을 모두 확인해 주세요.');
      return;
    }

    if (!validatePassword()) {
      setErrorMessage('비밀번호 형식을 확인해 주세요.');
      return;
    }

    if (!(await validateLoginId())) {
      setErrorMessage('아이디를 확인해 주세요.');
      return;
    }

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
              setLoginIdAvailable(null);
            }}
            onBlur={() => void validateLoginId()}
            invalid={loginIdAvailable === false}
            required
          />
          {loginIdMessage && (
            <p className={loginIdAvailable === false ? styles.fieldError : styles.fieldMessage}>
              {loginIdMessage}
            </p>
          )}

          <label className={styles.label} htmlFor="signup-pw">
            비밀번호
          </label>
          <PasswordField
            id="signup-pw"
            className={styles.field}
            placeholder="비밀번호"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setPasswordError('');
            }}
            onBlur={() => {
              validatePassword();
            }}
            aria-describedby="signup-pw-hint"
            invalid={Boolean(passwordError)}
            required
          />
          <p
            id="signup-pw-hint"
            className={passwordError ? styles.fieldError : styles.fieldMessage}
          >
            {passwordError || PASSWORD_HINT}
          </p>

          <label className={styles.label} htmlFor="signup-station">
            담당 역
          </label>
          <SelectField
            id="signup-station"
            className={styles.field}
            value={stationId}
            onChange={(event) => setStationId(event.target.value)}
            disabled={stationsQuery.isPending || stations.length === 0}
            required
          >
            <option value="" disabled>
              {stationsQuery.isPending ? '역 목록을 불러오는 중…' : '담당 역을 선택해 주세요'}
            </option>
            {stations.map((station) => (
              <option key={station.stationId} value={String(station.stationId ?? '')}>
                {station.nameKo}
                {station.lineInfo ? ` · ${station.lineInfo}` : ''}
              </option>
            ))}
          </SelectField>
          {stationsQuery.isError && (
            <p className={styles.fieldError}>역 목록을 불러오지 못했습니다.</p>
          )}

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
