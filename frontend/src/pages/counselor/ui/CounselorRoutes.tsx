import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from '@/features/console-auth';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { ConnectFailedPage } from './ConnectFailedPage/ConnectFailedPage';
import { ConnectingPage } from './ConnectingPage/ConnectingPage';
import { HistoryPage } from './HistoryPage/HistoryPage';
import { LoginPage } from './LoginPage/LoginPage';
import { PendingPage } from './PendingPage/PendingPage';
import { RequestsPage } from './RequestsPage/RequestsPage';
import { SessionPage } from './SessionPage/SessionPage';
import { SignupPage } from './SignupPage/SignupPage';

const rel = (path: string) => path.slice('/counselor/'.length);

export function CounselorRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to={COUNSELOR_ROUTES.LOGIN} replace />} />
      <Route path={rel(COUNSELOR_ROUTES.LOGIN)} element={<LoginPage />} />
      <Route path={rel(COUNSELOR_ROUTES.SIGNUP)} element={<SignupPage />} />
      <Route path={rel(COUNSELOR_ROUTES.PENDING)} element={<PendingPage />} />
      <Route
        path={rel(COUNSELOR_ROUTES.REQUESTS)}
        element={
          <RequireRole role="COUNSELOR" loginPath={COUNSELOR_ROUTES.LOGIN}>
            <RequestsPage />
          </RequireRole>
        }
      />
      <Route
        path={rel(COUNSELOR_ROUTES.CONNECTING)}
        element={
          <RequireRole role="COUNSELOR" loginPath={COUNSELOR_ROUTES.LOGIN}>
            <ConnectingPage />
          </RequireRole>
        }
      />
      <Route
        path={rel(COUNSELOR_ROUTES.CONNECT_FAILED)}
        element={
          <RequireRole role="COUNSELOR" loginPath={COUNSELOR_ROUTES.LOGIN}>
            <ConnectFailedPage />
          </RequireRole>
        }
      />
      <Route
        path={rel(COUNSELOR_ROUTES.SESSION)}
        element={
          <RequireRole role="COUNSELOR" loginPath={COUNSELOR_ROUTES.LOGIN}>
            <SessionPage />
          </RequireRole>
        }
      />
      <Route
        path={rel(COUNSELOR_ROUTES.HISTORY)}
        element={
          <RequireRole role="COUNSELOR" loginPath={COUNSELOR_ROUTES.LOGIN}>
            <HistoryPage />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to={COUNSELOR_ROUTES.LOGIN} replace />} />
    </Routes>
  );
}
