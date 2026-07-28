import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from '@/pages/home';
import { NotFoundPage } from '@/pages/not-found';
import { ADMIN_ROUTES, COUNSELOR_ROUTES, ROUTES, USER_ROUTES } from '@/shared/config';

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

/**
 * Entry redirects live here rather than inside each lazy chunk, so landing on
 * a section root resolves before its chunk has to load.
 */
export function AppRouter() {
  return (
    <Suspense
      fallback={
        <p role="status" aria-live="polite">
          불러오는 중…
        </p>
      }
    >
        <Routes>
          <Route path={ROUTES.HOME} element={<HomePage />} />

          <Route path={ROUTES.USER} element={<Navigate to={USER_ROUTES.SPLASH} replace />} />
          <Route path={ROUTES.INDOOR_MAP} element={<IndoorMapPage />} />
          <Route path={`${ROUTES.USER}/*`} element={<UserPage />} />

        <Route path={ROUTES.COUNSELOR} element={<Navigate to={COUNSELOR_ROUTES.LOGIN} replace />} />
        <Route path={`${ROUTES.COUNSELOR}/*`} element={<CounselorPage />} />

        <Route path={ROUTES.ADMIN} element={<Navigate to={ADMIN_ROUTES.LOGIN} replace />} />
        <Route path={`${ROUTES.ADMIN}/*`} element={<AdminPage />} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
