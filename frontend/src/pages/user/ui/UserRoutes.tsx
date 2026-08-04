import { Navigate, Route, Routes } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useUserSessionBootstrap } from '@/entities/user-session';
import { RequirePermissions } from '@/features/permissions';
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
  const clearConsultation = useConsultStore((state) => state.clearConsultation);
  useUserSessionBootstrap({ onSessionExpired: clearConsultation });

  return (
    <Routes>
      <Route index element={<Navigate to={USER_ROUTES.SPLASH} replace />} />

      {/* Onboarding */}
      <Route path={rel(USER_ROUTES.SPLASH)} element={<SplashPage />} />
      <Route path={rel(USER_ROUTES.LANGUAGE)} element={<LanguagePage />} />
      <Route path={rel(USER_ROUTES.PERMISSION)} element={<PermissionPage />} />

      {/*
        여기서부터는 세 권한이 살아 있어야 한다.

        권한 화면을 통과한 뒤 브라우저 설정에서 권한을 꺼도 그대로 이용되던 문제 때문에 둔다.
        도중에 사라진 권한은 처음부터 없었던 것과 같게 다뤄, 권한 화면으로 돌려보낸다.

        **설정 화면도 안에 둔다.** 권한 카드가 상태를 보여 주기만 하게 바뀐 뒤로 거기서 할 수
        있는 일이 없다. 복구 안내와 다시 갖춰졌을 때의 자동 진행은 권한 화면이 갖고 있으므로,
        설정 화면에서 권한을 풀었을 때 돌아갈 곳도 거기다.

        오프라인 화면만 밖에 남긴다. 그쪽은 네트워크 이야기라, 권한 문제로 가려 버리면 사용자가
        무엇 때문에 막혔는지 알 수 없다.
      */}
      <Route element={<RequirePermissions />}>
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
        {/* 역 밖 도보 안내는 다루지 않는다. 안내는 출입구에서 끝난다. */}
        <Route path="external-map" element={<Navigate to={USER_ROUTES.STATION} replace />} />

        {/* Consultation */}
        <Route path={rel(USER_ROUTES.CONSULT_REQUEST)} element={<ConsultRequestPage />} />
        <Route path={rel(USER_ROUTES.CONSULT_PERMISSION)} element={<ConsultPermissionPage />} />

        <Route path={rel(USER_ROUTES.SETTINGS)} element={<SettingsPage />} />
      </Route>

      {/*
        상담이 시작된 뒤의 화면들은 가드 밖에 둔다.

        가드는 권한이 사라지면 곧바로 권한 화면으로 돌려보낸다. 그거면 되는 화면이 대부분이지만
        이쪽은 아니다. 잡아 둔 카메라·마이크가 그대로 남고, 서버의 상담도 진행 중으로 남아
        상담자는 연결돼 있다고 믿은 채 빈 화면에 대고 안내를 이어 간다.

        그래서 대기·상담 화면이 `usePermissionsRevoked`로 직접 알아채고, 장치를 놓아 준 뒤
        서버의 상담까지 정리하고 나서 떠난다. 종료 화면은 장치를 쓰지 않으므로 애초에 권한을
        요구할 이유가 없다 — 정리하고 도착하는 곳이기도 하다.
      */}
      <Route path={rel(USER_ROUTES.CONSULT_WAITING)} element={<ConsultWaitingPage />} />
      <Route path={rel(USER_ROUTES.CONSULT_SESSION)} element={<ConsultSessionPage />} />
      <Route path={rel(USER_ROUTES.CONSULT_ENDED)} element={<ConsultEndedPage />} />

      <Route path={rel(USER_ROUTES.OFFLINE)} element={<OfflinePage />} />

      <Route path="*" element={<Navigate to={USER_ROUTES.SPLASH} replace />} />
    </Routes>
  );
}
