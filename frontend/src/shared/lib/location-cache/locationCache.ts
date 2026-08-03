const STORAGE_KEY = 'pingo.last-location';
const MAX_AGE_MS = 5 * 60 * 1000;

export type CachedLocation = {
  latitude: number;
  longitude: number;
  capturedAt: number;
};

export function saveLocation(position: GeolocationPosition): void {
  try {
    const location: CachedLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      capturedAt: position.timestamp || Date.now(),
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Storage may be unavailable in privacy mode; fresh GPS remains the fallback.
  }
}

export function readRecentLocation(): CachedLocation | undefined {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) return undefined;

    const location = JSON.parse(value) as CachedLocation;
    const validCoordinates =
      Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
    if (!validCoordinates || Date.now() - location.capturedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return undefined;
    }
    return location;
  } catch {
    return undefined;
  }
}
