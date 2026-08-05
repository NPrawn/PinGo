import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { unwrap, unwrapVoid } from '../request';
import type { components } from '../schema';

type Schemas = components['schemas'];

export type UserSessionCreateRequest = Schemas['UserSessionCreateRequest'];
export type UserSessionCreateResponse = Schemas['UserSessionCreateResponse'];
export type UserSessionResponse = Schemas['UserSessionResponse'];
export type UserSessionUpdateRequest = Schemas['UserSessionUpdateRequest'];
export type StationNearbyResponse = Schemas['StationNearbyResponse'];
export type StationSearchResponse = Schemas['StationSearchResponse'];
export type StationDetailResponse = Schemas['StationDetailResponse'];
export type FloorMapResponse = Schemas['FloorMapResponse'];
export type FacilityResponse = Schemas['FacilityResponse'];
export type FacilityDetailResponse = Schemas['FacilityDetailResponse'];
export type DestinationSearchResponse = Schemas['DestinationSearchResponse'];
export type NearestExitRequest = Schemas['NearestExitRequest'];
export type NearestExitResponse = Schemas['NearestExitResponse'];
export type RecommendedExitResponse = Schemas['RecommendedExitResponse'];
export type RouteOptionsRequest = Schemas['RouteOptionsRequest'];
export type RouteOptionResponse = Schemas['RouteOptionResponse'];
export type RouteCreateRequest = Schemas['RouteCreateRequest'];
export type RouteResponse = Schemas['RouteResponse'];
export type LocalizationRequestMetadata = Schemas['LocalizationRequestMetadata'];
type GeneratedLocalizationResponse = Schemas['LocalizationResponse'];
export type LocalizationCandidatePositionResponse = NonNullable<
  GeneratedLocalizationResponse['position']
> & {
  floorId: number;
  floorCode: string;
  mapX: number;
  mapY: number;
};
export type LocalizationCandidateResponse = {
  position: LocalizationCandidatePositionResponse;
  startNodeId: number;
  startNodeLabel?: string | null;
  confidenceScore: number;
};
export type LocalizationResponse = GeneratedLocalizationResponse & {
  candidate?: LocalizationCandidateResponse | null;
  confidenceScore?: number | null;
};
export type ExternalDirectionRequest = Schemas['ExternalDirectionRequest'];
export type ExternalDirectionResponse = Schemas['ExternalDirectionResponse'];

export function getHealth() {
  return apiClient.get<string>('/api/health').then(({ data }) => data);
}

export function createUserSession(request: UserSessionCreateRequest) {
  return unwrap<UserSessionCreateResponse>(apiClient.post(ENDPOINTS.userSessions.root, request));
}

export function getUserSession(userSessionId: string) {
  return unwrap<UserSessionResponse>(apiClient.get(ENDPOINTS.userSessions.detail(userSessionId)));
}

export function updateUserSession(userSessionId: string, request: UserSessionUpdateRequest) {
  return unwrap<UserSessionResponse>(
    apiClient.patch(ENDPOINTS.userSessions.detail(userSessionId), request),
  );
}

export function deleteUserSession(userSessionId: string) {
  return unwrapVoid(apiClient.delete(ENDPOINTS.userSessions.detail(userSessionId)));
}

export function getNearbyStations(latitude: number, longitude: number) {
  return unwrap<StationNearbyResponse[]>(
    apiClient.get(ENDPOINTS.stations.nearby, {
      params: { latitude, longitude },
    }),
  );
}

/** keyword를 비우면 서비스 중인 역 전체를 반환한다. */
export function searchStations(keyword?: string) {
  return unwrap<StationSearchResponse[]>(
    apiClient.get(ENDPOINTS.stations.search, {
      params: { keyword },
    }),
  );
}

export function getStation(stationId: number) {
  return unwrap<StationDetailResponse>(apiClient.get(ENDPOINTS.stations.detail(stationId)));
}

export function getStationMaps(stationId: number) {
  return unwrap<FloorMapResponse[]>(apiClient.get(ENDPOINTS.stationFloorMaps(stationId)));
}

export function getStationFacilities(
  stationId: number,
  filters: {
    floorId?: number;
    facilityType?: string;
  } = {},
) {
  return unwrap<FacilityResponse[]>(
    apiClient.get(ENDPOINTS.stations.facilities(stationId), {
      params: filters,
    }),
  );
}

export function getFacility(facilityId: number) {
  return unwrap<FacilityDetailResponse>(apiClient.get(ENDPOINTS.facilities.detail(facilityId)));
}

export function searchDestinations(stationId: number, keyword: string) {
  return unwrap<DestinationSearchResponse[]>(
    apiClient.get(ENDPOINTS.destinations.search, {
      params: { stationId, keyword },
    }),
  );
}

/** 목적지 좌표에서 가장 가까운 출구를 찾는다. 최단 경로가 안내할 출입구다. */
export function findNearestExit(request: NearestExitRequest) {
  return unwrap<NearestExitResponse>(apiClient.post(ENDPOINTS.destinations.nearestExit, request));
}

export function getRecommendedExits(placeId: number) {
  return unwrap<RecommendedExitResponse[]>(
    apiClient.get(ENDPOINTS.places.recommendedExits(placeId)),
  );
}

export function getIndoorRouteOptions(request: RouteOptionsRequest) {
  return unwrap<RouteOptionResponse[]>(apiClient.post(ENDPOINTS.routes.indoorOptions, request));
}

export function createIndoorRoute(request: RouteCreateRequest) {
  return unwrap<RouteResponse>(apiClient.post(ENDPOINTS.routes.indoor, request));
}

export function getExternalWalkingDirection(request: ExternalDirectionRequest) {
  return unwrap<ExternalDirectionResponse>(
    apiClient.post(ENDPOINTS.externalMaps.directions, request),
  );
}

export function localize(image: File, metadata: LocalizationRequestMetadata) {
  const formData = new FormData();
  formData.append('image', image);
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));

  return unwrap<LocalizationResponse>(
    apiClient.post(ENDPOINTS.vps.localize, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}
