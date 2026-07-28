import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/home';
import { NotFoundPage } from '@/pages/not-found';
import { ROUTES } from '@/shared/config';

const UserPage = lazy(() =>
  import('@/pages/user').then((module) => ({ default: module.UserPage })),
);
const IndoorMapPage = lazy(() =>
  import('@/pages/indoor-map').then((module) => ({ default: module.IndoorMapPage })),
);
const CounselorPage = lazy(() =>
  import('@/pages/counselor').then((module) => ({ default: module.CounselorPage })),
);
const AdminPage = lazy(() =>
  import('@/pages/admin').then((module) => ({ default: module.AdminPage })),
);
const PermissionTestPage = lazy(() =>
  import('@/pages/permission-test').then((module) => ({
    default: module.PermissionTestPage,
  })),
);

export function AppRouter() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <Routes>
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route path={ROUTES.INDOOR_MAP} element={<IndoorMapPage />} />
        <Route path={`${ROUTES.USER}/*`} element={<UserPage />} />
        <Route path={`${ROUTES.COUNSELOR}/*`} element={<CounselorPage />} />
        <Route path={`${ROUTES.ADMIN}/*`} element={<AdminPage />} />
        <Route path={ROUTES.PERMISSION_TEST} element={<PermissionTestPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
