import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_ROUTES } from '@/shared/config';
import { ConsolePage } from './ConsolePage';

/**
 * The admin console.
 *
 * TODO: Guard these routes once the auth contract is agreed — every screen
 * requires an authenticated admin.
 */
export function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to={`${ADMIN_ROUTES.CONSOLE}/facility`} replace />} />
      <Route
        path="console"
        element={<Navigate to={`${ADMIN_ROUTES.CONSOLE}/facility`} replace />}
      />
      <Route path="console/:tab" element={<ConsolePage />} />
      <Route path="*" element={<Navigate to={`${ADMIN_ROUTES.CONSOLE}/facility`} replace />} />
    </Routes>
  );
}
