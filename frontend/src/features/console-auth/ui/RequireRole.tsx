import { useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AUTH_EXPIRED_EVENT, getAuthSession } from '@/shared/api';

type RequireRoleProps = {
  role: 'COUNSELOR' | 'ADMIN';
  loginPath: string;
  children: ReactNode;
};

export function RequireRole({ role, loginPath, children }: RequireRoleProps) {
  const [session, setSession] = useState(getAuthSession);

  /**
   * 세션이 만료되면 그 자리에서 로그인 화면으로 보낸다.
   *
   * 렌더할 때만 확인하면, 토큰이 만료돼도 다음 화면 전환까지 아무 일이 없다. 상담자는
   * 한참 뒤 상담 종료 같은 엉뚱한 순간에 로그인 화면을 만나게 된다.
   */
  useEffect(() => {
    const onExpired = () => setSession(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  if (!session || session.accountType !== role) {
    return <Navigate to={loginPath} replace />;
  }

  return children;
}
