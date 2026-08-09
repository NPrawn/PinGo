/**
 * Route paths for the whole app.
 *
 * The prototype switched screens through `location.hash` (`#s-splash`,
 * `#c-login`, ...). Each of those screens is a real route here. The legacy
 * hash id is kept in a comment so the prototype markup stays traceable.
 */

const USER = '/user';
const COUNSELOR = '/counselor';
const ADMIN = '/admin';

export const ROUTES = {
  HOME: '/',
  USER,
  /** Indoor map. Receives stationId and floorId through query parameters. */
  INDOOR_MAP: `${USER}/map`,
  COUNSELOR,
  ADMIN,
} as const;

/** User-facing flow. Prototype ids `s-*`. */
export const USER_ROUTES = {
  SPLASH: `${USER}/splash`, // s-splash
  LANGUAGE: `${USER}/language`, // s-lang
  PERMISSION: `${USER}/permission`, // s-perm
  STATION: `${USER}/station`, // s-station
  CAPTURE_GUIDE: `${USER}/capture`, // s-cam
  CAPTURE_PORTRAIT: `${USER}/capture/portrait`, // s-cam-port
  /** Legacy deep link. Redirects to the combined capture and matching screen. */
  ANALYZING: `${USER}/analyzing`,
  /**
   * 위치 인식은 카메라 촬영만 쓴다.
   *
   * 프로토타입의 실패 화면(s-fail)과 지도 직접 선택(s-mapselect)은 두지 않는다. 촬영이
   * 실패하면 촬영 화면이 시트로 재촬영·상담을 안내한다.
   */
  LOCATE_SUCCESS: `${USER}/locate/success`, // s-success
  ROUTE_OPTIONS: `${USER}/route`, // s-route
  NAVIGATION: `${USER}/navigation`, // s-nav
  BACKSTAGE: `${USER}/backstage`,
  NAVIGATION_REROUTE: `${USER}/navigation/reroute`, // s-reroute
  ARRIVAL: `${USER}/arrival`, // s-arrive
  OFFLINE: `${USER}/offline`, // s-offline
  SETTINGS: `${USER}/settings`, // s-settings
  CONSULT_REQUEST: `${USER}/consult`, // s-consult-req
  CONSULT_PERMISSION: `${USER}/consult/permission`, // s-consult-perm
  CONSULT_WAITING: `${USER}/consult/waiting`, // s-consult-wait
  CONSULT_SESSION: `${USER}/consult/session`, // s-consult-rtc
  CONSULT_ENDED: `${USER}/consult/ended`, // s-consult-end
} as const;

/** Counselor console. Prototype ids `c-*`. */
export const COUNSELOR_ROUTES = {
  LOGIN: `${COUNSELOR}/login`, // c-login
  SIGNUP: `${COUNSELOR}/signup`, // c-signup
  PENDING: `${COUNSELOR}/pending`, // c-pending
  REQUESTS: `${COUNSELOR}/requests`, // c-list
  CONNECTING: `${COUNSELOR}/session/connecting`, // c-connecting
  CONNECT_FAILED: `${COUNSELOR}/session/failed`, // c-failed
  SESSION: `${COUNSELOR}/session`, // c-rtc
  HISTORY: `${COUNSELOR}/history`, // c-history
} as const;

/** Admin console. Prototype id `a-console`, one screen with six tabs. */
export const ADMIN_ROUTES = {
  /** Same console sign-in as the counselor section; credentials pick the target. */
  LOGIN: `${ADMIN}/login`, // c-login
  CONSOLE: `${ADMIN}/console`, // a-console
} as const;

/** Tabs inside the admin console, used as the `:tab` route param. */
export const ADMIN_TABS = ['station', 'map', 'facility', 'route', 'counselor'] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];
