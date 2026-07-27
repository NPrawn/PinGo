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
  CAPTURE_LANDSCAPE: `${USER}/capture/landscape`, // s-cam-land
  ANALYZING: `${USER}/analyzing`, // s-analyze
  LOCATE_FAILED: `${USER}/locate/failed`, // s-fail
  LOCATE_MANUAL: `${USER}/locate/manual`, // s-mapselect
  LOCATE_SUCCESS: `${USER}/locate/success`, // s-success
  DESTINATION: `${USER}/destination`, // s-dest
  DESTINATION_MAP: `${USER}/destination/map`, // s-destmap
  ROUTE_OPTIONS: `${USER}/route`, // s-route
  NAVIGATION: `${USER}/navigation`, // s-nav
  NAVIGATION_REROUTE: `${USER}/navigation/reroute`, // s-reroute
  ARRIVAL: `${USER}/arrival`, // s-arrive
  EXTERNAL_MAP: `${USER}/external-map`, // s-external
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
  STATS: `${COUNSELOR}/stats`, // c-stats
} as const;

/** Admin console. Prototype id `a-console`, one screen with six tabs. */
export const ADMIN_ROUTES = {
  CONSOLE: `${ADMIN}/console`, // a-console
} as const;

/** Tabs inside the admin console, used as the `:tab` route param. */
export const ADMIN_TABS = ['station', 'map', 'facility', 'route', 'place', 'counselor'] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];
