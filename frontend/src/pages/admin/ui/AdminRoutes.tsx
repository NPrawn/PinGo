import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole } from '@/features/console-auth';
import { ADMIN_ROUTES } from '@/shared/config';
import { ConsolePage } from './ConsolePage';
import { LoginPage } from './LoginPage/LoginPage';

const FACILITY_TAB = `${ADMIN_ROUTES.CONSOLE}/facility`;

export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to={ADMIN_ROUTES.LOGIN} replace />} />
      <Route path="login" element={<LoginPage />} />
      <Route path="console" element={<Navigate to={FACILITY_TAB} replace />} />
      <Route
        path="console/:tab"
        element={
          <RequireRole role="ADMIN" loginPath={ADMIN_ROUTES.LOGIN}>
            <ConsolePage />
          </RequireRole>
        }
      />
      <Route path="*" element={<Navigate to={ADMIN_ROUTES.LOGIN} replace />} />
    </Routes>
  );
}
