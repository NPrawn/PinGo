import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUserSessionBootstrap } from '@/entities/user-session';
import { USER_ROUTES } from '@/shared/config';
import { ArrivalPage } from './ArrivalPage/ArrivalPage';
import { BackstagePage } from './BackstagePage/BackstagePage';
import { CaptureGuidePage } from './CaptureGuidePage/CaptureGuidePage';
import { CapturePortraitPage } from './CapturePortraitPage/CapturePortraitPage';
import { ConsultEndedPage } from './ConsultEndedPage/ConsultEndedPage';
import { ConsultPermissionPage } from './ConsultPermissionPage/ConsultPermissionPage';
import { ConsultRequestPage } from './ConsultRequestPage/ConsultRequestPage';
import { ConsultSessionPage } from './ConsultSessionPage/ConsultSessionPage';
import { ConsultWaitingPage } from './ConsultWaitingPage/ConsultWaitingPage';
import { ExternalMapPage } from './ExternalMapPage/ExternalMapPage';
import { LanguagePage } from './LanguagePage/LanguagePage';
import { LocateSuccessPage } from './LocateSuccessPage/LocateSuccessPage';
import { NavigationPage } from './NavigationPage/NavigationPage';
import { OfflinePage } from './OfflinePage/OfflinePage';
import { PermissionPage } from './PermissionPage/PermissionPage';
import { ReroutePage } from './ReroutePage/ReroutePage';
import { RouteOptionsPage } from './RouteOptionsPage/RouteOptionsPage';
import { SettingsPage } from './SettingsPage/SettingsPage';
import { SplashPage } from './SplashPage/SplashPage';
import { StationPage } from './StationPage/StationPage';

/** Strips the `/user` prefix so the child paths stay readable. */
const rel = (path: string) => path.slice('/user/'.length);

/**
 * The user-facing flow.
 *
 * Each screen is its own route. The prototype switched between them with
 * `location.hash`, which meant no history, no deep links and no code splitting.
 * The legacy hash id for each route is recorded in `shared/config/routes.ts`.
 */
export function UserRoutes() {
  const { i18n } = useTranslation();
  useUserSessionBootstrap(i18n.language);

  return (
    <Routes>
      <Route index element={<Navigate to={USER_ROUTES.SPLASH} replace />} />

      {/* Onboarding */}
      <Route path={rel(USER_ROUTES.SPLASH)} element={<SplashPage />} />
      <Route path={rel(USER_ROUTES.LANGUAGE)} element={<LanguagePage />} />
      <Route path={rel(USER_ROUTES.PERMISSION)} element={<PermissionPage />} />
      <Route path={rel(USER_ROUTES.STATION)} element={<StationPage />} />

      {/* Location capture and recognition */}
      <Route path={rel(USER_ROUTES.CAPTURE_GUIDE)} element={<CaptureGuidePage />} />
      <Route path={rel(USER_ROUTES.CAPTURE_PORTRAIT)} element={<CapturePortraitPage />} />
      <Route
        path={rel(USER_ROUTES.ANALYZING)}
        element={<Navigate to={USER_ROUTES.CAPTURE_PORTRAIT} replace />}
      />
      {/*
        위치 인식은 카메라 촬영만 쓴다. 실패하면 촬영 화면이 시트를 띄워 재촬영·상담으로
        보내므로, 지도에서 직접 고르는 화면(locate/manual)과 실패 전용 화면(locate/failed)은
        두지 않는다. 예전 링크는 촬영 화면으로 돌린다.
      */}
      <Route
        path="locate/failed"
        element={<Navigate to={USER_ROUTES.CAPTURE_PORTRAIT} replace />}
      />
      <Route
        path="locate/manual"
        element={<Navigate to={USER_ROUTES.CAPTURE_PORTRAIT} replace />}
      />
      <Route path={rel(USER_ROUTES.LOCATE_SUCCESS)} element={<LocateSuccessPage />} />

      {/* Destination and routing */}
      <Route path="destination/*" element={<Navigate to={USER_ROUTES.STATION} replace />} />
      <Route path={rel(USER_ROUTES.ROUTE_OPTIONS)} element={<RouteOptionsPage />} />
      <Route path={rel(USER_ROUTES.NAVIGATION)} element={<NavigationPage />} />
      <Route path={rel(USER_ROUTES.BACKSTAGE)} element={<BackstagePage />} />
      <Route path={rel(USER_ROUTES.NAVIGATION_REROUTE)} element={<ReroutePage />} />
      <Route path={rel(USER_ROUTES.ARRIVAL)} element={<ArrivalPage />} />
      <Route path={rel(USER_ROUTES.EXTERNAL_MAP)} element={<ExternalMapPage />} />

      {/* Consultation */}
      <Route path={rel(USER_ROUTES.CONSULT_REQUEST)} element={<ConsultRequestPage />} />
      <Route path={rel(USER_ROUTES.CONSULT_PERMISSION)} element={<ConsultPermissionPage />} />
      <Route path={rel(USER_ROUTES.CONSULT_WAITING)} element={<ConsultWaitingPage />} />
      <Route path={rel(USER_ROUTES.CONSULT_SESSION)} element={<ConsultSessionPage />} />
      <Route path={rel(USER_ROUTES.CONSULT_ENDED)} element={<ConsultEndedPage />} />

      {/* Settings and exceptions */}
      <Route path={rel(USER_ROUTES.SETTINGS)} element={<SettingsPage />} />
      <Route path={rel(USER_ROUTES.OFFLINE)} element={<OfflinePage />} />

      <Route path="*" element={<Navigate to={USER_ROUTES.SPLASH} replace />} />
    </Routes>
  );
}
