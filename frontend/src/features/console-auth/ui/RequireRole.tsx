import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getAuthSession } from '@/shared/api';

type RequireRoleProps = {
  role: 'COUNSELOR' | 'ADMIN';
  loginPath: string;
  children: ReactNode;
};

export function RequireRole({ role, loginPath, children }: RequireRoleProps) {
  const session = getAuthSession();

  if (!session || session.accountType !== role) {
    return <Navigate to={loginPath} replace />;
  }

  return children;
}
