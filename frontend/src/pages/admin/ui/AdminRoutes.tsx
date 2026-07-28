import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_ROUTES } from '@/shared/config';
import { ConsolePage } from './ConsolePage';
import { LoginPage } from './LoginPage/LoginPage';

const FACILITY_TAB = `${ADMIN_ROUTES.CONSOLE}/facility`;

/**
 * The admin console.
 *
 * Entry is the shared console sign-in; the credentials entered there decide
 * whether the user lands here or in the counselor console.
 *
 * TODO: Guard the console routes once the auth contract is agreed — right now
 * they are reachable directly.
 */
export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to={ADMIN_ROUTES.LOGIN} replace />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="console" element={<Navigate to={FACILITY_TAB} replace />} />
      <Route path="console/:tab" element={<ConsolePage />} />
      <Route path="*" element={<Navigate to={ADMIN_ROUTES.LOGIN} replace />} />
    </Routes>
  );
}
