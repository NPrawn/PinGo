import { Navigate, Route, Routes } from 'react-router-dom';
import { COUNSELOR_ROUTES } from '@/shared/config';
import { ConnectFailedPage } from './ConnectFailedPage/ConnectFailedPage';
import { ConnectingPage } from './ConnectingPage/ConnectingPage';
import { HistoryPage } from './HistoryPage/HistoryPage';
import { LoginPage } from './LoginPage/LoginPage';
import { PendingPage } from './PendingPage/PendingPage';
import { RequestsPage } from './RequestsPage/RequestsPage';
import { SessionPage } from './SessionPage/SessionPage';
import { SignupPage } from './SignupPage/SignupPage';
import { StatsPage } from './StatsPage/StatsPage';

const rel = (path: string) => path.slice('/counselor/'.length);

/**
 * The counselor console.
 *
 * TODO: Add a route guard once the auth contract is agreed — every screen
 * below `login` should require a signed-in counselor.
 */
export function CounselorRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to={COUNSELOR_ROUTES.LOGIN} replace />} />
      <Route path={rel(COUNSELOR_ROUTES.LOGIN)} element={<LoginPage />} />
      <Route path={rel(COUNSELOR_ROUTES.SIGNUP)} element={<SignupPage />} />
      <Route path={rel(COUNSELOR_ROUTES.PENDING)} element={<PendingPage />} />
      <Route path={rel(COUNSELOR_ROUTES.REQUESTS)} element={<RequestsPage />} />
      <Route path={rel(COUNSELOR_ROUTES.CONNECTING)} element={<ConnectingPage />} />
      <Route path={rel(COUNSELOR_ROUTES.CONNECT_FAILED)} element={<ConnectFailedPage />} />
      <Route path={rel(COUNSELOR_ROUTES.SESSION)} element={<SessionPage />} />
      <Route path={rel(COUNSELOR_ROUTES.HISTORY)} element={<HistoryPage />} />
      <Route path={rel(COUNSELOR_ROUTES.STATS)} element={<StatsPage />} />
      <Route path="*" element={<Navigate to={COUNSELOR_ROUTES.LOGIN} replace />} />
    </Routes>
  );
}
