import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/home';
import { NotFoundPage } from '@/pages/not-found';
import { ROUTES } from '@/shared/config';

const UserPage = lazy(() =>
  import('@/pages/user').then((module) => ({ default: module.UserPage })),
);
const CounselorPage = lazy(() =>
  import('@/pages/counselor').then((module) => ({ default: module.CounselorPage })),
);
const AdminPage = lazy(() =>
  import('@/pages/admin').then((module) => ({ default: module.AdminPage })),
);

export function AppRouter() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <Routes>
        <Route path={ROUTES.HOME} element={<HomePage />} />
        <Route path={`${ROUTES.USER}/*`} element={<UserPage />} />
        <Route path={`${ROUTES.COUNSELOR}/*`} element={<CounselorPage />} />
        <Route path={`${ROUTES.ADMIN}/*`} element={<AdminPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
