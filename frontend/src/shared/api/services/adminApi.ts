import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { unwrap, unwrapVoid } from '../request';
import type { components } from '../schema';

type Schemas = components['schemas'];

export type Station = Schemas['StationResponse'];
export type StationDetail = Schemas['StationDetailResponse'];
export type StationCreateRequest = Schemas['StationCreateRequest'];
export type StationUpdateRequest = Schemas['StationUpdateRequest'];
export type Floor = Schemas['FloorResponse'];
export type FloorCreateRequest = Schemas['FloorCreateRequest'];
export type FloorUpdateRequest = Schemas['FloorUpdateRequest'];
export type FloorMap = Schemas['FloorMapResponse'];
export type FloorMapUploadRequest = Schemas['FloorMapUploadRequest'];
export type Facility = Schemas['FacilityResponse'];
export type FacilityDetail = Schemas['FacilityDetailResponse'];
export type FacilityCreateRequest = Schemas['FacilityCreateRequest'];
export type FacilityUpdateRequest = Schemas['FacilityUpdateRequest'];
export type RouteNode = Schemas['RouteNodeResponse'];
export type RouteNodeCreateRequest = Schemas['RouteNodeCreateRequest'];
export type RouteNodeUpdateRequest = Schemas['RouteNodeUpdateRequest'];
export type RouteEdge = Schemas['RouteEdgeResponse'];
export type RouteEdgeCreateRequest = Schemas['RouteEdgeCreateRequest'];
export type RouteEdgeUpdateRequest = Schemas['RouteEdgeUpdateRequest'];
export type NearbyPlace = Schemas['NearbyPlaceResponse'];
export type NearbyPlaceCreateRequest = Schemas['NearbyPlaceCreateRequest'];
export type NearbyPlaceUpdateRequest = Schemas['NearbyPlaceUpdateRequest'];
export type PlaceExitRecommendation = Schemas['PlaceExitRecommendationResponse'];
export type PlaceExitRecommendationCreateRequest = Schemas['PlaceExitRecommendationCreateRequest'];
export type CounselorAccount = Schemas['AccountListResponse'];
export type CounselorAccountDetail = Schemas['AccountDetailResponse'];
export type CounselorAccountUpdateRequest = Schemas['AccountUpdateRequest'];

export function getAdminStations() {
  return unwrap<Station[]>(apiClient.get(ENDPOINTS.admin.stations));
}

export function createAdminStation(request: StationCreateRequest) {
  return unwrap<Schemas['StationIdResponse']>(apiClient.post(ENDPOINTS.admin.stations, request));
}

export function getAdminStation(stationId: number) {
  return unwrap<StationDetail>(apiClient.get(ENDPOINTS.admin.station(stationId)));
}

export function updateAdminStation(stationId: number, request: StationUpdateRequest) {
  return unwrap<StationDetail>(apiClient.patch(ENDPOINTS.admin.station(stationId), request));
}

export function deleteAdminStation(stationId: number) {
  return unwrapVoid(apiClient.delete(ENDPOINTS.admin.station(stationId)));
}

export function getAdminFloors(stationId: number) {
  return unwrap<Floor[]>(apiClient.get(ENDPOINTS.admin.stationFloors(stationId)));
}

export function createAdminFloor(stationId: number, request: FloorCreateRequest) {
  return unwrap<Schemas['FloorIdResponse']>(
    apiClient.post(ENDPOINTS.admin.stationFloors(stationId), request),
  );
}

export function updateAdminFloor(floorId: number, request: FloorUpdateRequest) {
  return unwrap<Floor>(apiClient.patch(ENDPOINTS.admin.floor(floorId), request));
}

export function deleteAdminFloor(floorId: number) {
  return unwrapVoid(apiClient.delete(ENDPOINTS.admin.floor(floorId)));
}

export function getAdminFloorMaps(floorId: number) {
  return unwrap<FloorMap[]>(apiClient.get(ENDPOINTS.admin.floorMaps(floorId)));
}

export function uploadAdminFloorMap(
  floorId: number,
  request: FloorMapUploadRequest,
  mapFile?: File,
) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(request)) {
    if (value != null) formData.append(key, String(value));
  }
  if (mapFile) formData.append('mapFile', mapFile);

  return unwrap<Schemas['FloorMapIdResponse']>(
    apiClient.post(ENDPOINTS.admin.floorMaps(floorId), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  );
}

export function getAdminFacilities(filters: {
  stationId: number;
  floorId?: number;
  facilityType?: string;
}) {
  return unwrap<Facility[]>(apiClient.get(ENDPOINTS.admin.facilities, { params: filters }));
}

export function createAdminFacility(request: FacilityCreateRequest) {
  return unwrap<Schemas['FacilityIdResponse']>(apiClient.post(ENDPOINTS.admin.facilities, request));
}

export function getAdminFacility(facilityId: number) {
  return unwrap<FacilityDetail>(apiClient.get(ENDPOINTS.admin.facility(facilityId)));
}

export function updateAdminFacility(facilityId: number, request: FacilityUpdateRequest) {
  return unwrap<FacilityDetail>(apiClient.patch(ENDPOINTS.admin.facility(facilityId), request));
}

export function deleteAdminFacility(facilityId: number) {
  return unwrapVoid(apiClient.delete(ENDPOINTS.admin.facility(facilityId)));
}

export function getAdminRouteNodes(
  filters: {
    stationId?: number;
    floorId?: number;
  } = {},
) {
  return unwrap<RouteNode[]>(apiClient.get(ENDPOINTS.admin.routeNodes, { params: filters }));
}

export function createAdminRouteNode(request: RouteNodeCreateRequest) {
  return unwrap<Schemas['RouteNodeIdResponse']>(
    apiClient.post(ENDPOINTS.admin.routeNodes, request),
  );
}

export function getAdminRouteNode(nodeId: number) {
  return unwrap<RouteNode>(apiClient.get(ENDPOINTS.admin.routeNode(nodeId)));
}

export function updateAdminRouteNode(nodeId: number, request: RouteNodeUpdateRequest) {
  return unwrap<RouteNode>(apiClient.patch(ENDPOINTS.admin.routeNode(nodeId), request));
}

export function deleteAdminRouteNode(nodeId: number) {
  return unwrapVoid(apiClient.delete(ENDPOINTS.admin.routeNode(nodeId)));
}

export function getAdminRouteEdges(stationId?: number) {
  return unwrap<RouteEdge[]>(apiClient.get(ENDPOINTS.admin.routeEdges, { params: { stationId } }));
}

export function createAdminRouteEdge(request: RouteEdgeCreateRequest) {
  return unwrap<Schemas['RouteEdgeIdResponse']>(
    apiClient.post(ENDPOINTS.admin.routeEdges, request),
  );
}

export function getAdminRouteEdge(edgeId: number) {
  return unwrap<RouteEdge>(apiClient.get(ENDPOINTS.admin.routeEdge(edgeId)));
}

export function updateAdminRouteEdge(edgeId: number, request: RouteEdgeUpdateRequest) {
  return unwrap<RouteEdge>(apiClient.patch(ENDPOINTS.admin.routeEdge(edgeId), request));
}

export function deleteAdminRouteEdge(edgeId: number) {
  return unwrapVoid(apiClient.delete(ENDPOINTS.admin.routeEdge(edgeId)));
}

export function getAdminNearbyPlaces(stationId?: number) {
  return unwrap<NearbyPlace[]>(
    apiClient.get(ENDPOINTS.admin.nearbyPlaces, {
      params: { stationId },
    }),
  );
}

export function createAdminNearbyPlace(request: NearbyPlaceCreateRequest) {
  return unwrap<Schemas['NearbyPlaceIdResponse']>(
    apiClient.post(ENDPOINTS.admin.nearbyPlaces, request),
  );
}

export function getAdminNearbyPlace(placeId: number) {
  return unwrap<NearbyPlace>(apiClient.get(ENDPOINTS.admin.nearbyPlace(placeId)));
}

export function updateAdminNearbyPlace(placeId: number, request: NearbyPlaceUpdateRequest) {
  return unwrap<NearbyPlace>(apiClient.patch(ENDPOINTS.admin.nearbyPlace(placeId), request));
}

export function deleteAdminNearbyPlace(placeId: number) {
  return unwrapVoid(apiClient.delete(ENDPOINTS.admin.nearbyPlace(placeId)));
}

export function getAdminPlaceExitRecommendations(placeId?: number) {
  return unwrap<PlaceExitRecommendation[]>(
    apiClient.get(ENDPOINTS.admin.recommendations, {
      params: { placeId },
    }),
  );
}

export function createAdminPlaceExitRecommendation(request: PlaceExitRecommendationCreateRequest) {
  return unwrap<Schemas['PlaceExitRecommendationIdResponse']>(
    apiClient.post(ENDPOINTS.admin.recommendations, request),
  );
}

export function deleteAdminPlaceExitRecommendation(recommendationId: number) {
  return unwrapVoid(apiClient.delete(ENDPOINTS.admin.recommendation(recommendationId)));
}

export function getAdminCounselors(
  filters: {
    stationId?: number;
    isActive?: boolean;
  } = {},
) {
  return unwrap<CounselorAccount[]>(apiClient.get(ENDPOINTS.admin.counselors, { params: filters }));
}

export function getAdminCounselor(accountId: number) {
  return unwrap<CounselorAccountDetail>(apiClient.get(ENDPOINTS.admin.counselor(accountId)));
}

export function updateAdminCounselor(accountId: number, request: CounselorAccountUpdateRequest) {
  return unwrap<CounselorAccountDetail>(
    apiClient.patch(ENDPOINTS.admin.counselor(accountId), request),
  );
}

export function deactivateAdminCounselor(accountId: number) {
  return unwrapVoid(apiClient.delete(ENDPOINTS.admin.counselor(accountId)));
}
