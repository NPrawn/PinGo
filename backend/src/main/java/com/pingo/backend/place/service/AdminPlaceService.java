package com.pingo.backend.place.service;

import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.domain.FacilityType;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.place.domain.NearbyPlace;
import com.pingo.backend.place.domain.PlaceExitRecommendation;
import com.pingo.backend.place.dto.request.NearbyPlaceCreateRequest;
import com.pingo.backend.place.dto.request.NearbyPlaceUpdateRequest;
import com.pingo.backend.place.dto.request.PlaceExitRecommendationCreateRequest;
import com.pingo.backend.place.dto.response.NearbyPlaceIdResponse;
import com.pingo.backend.place.dto.response.NearbyPlaceResponse;
import com.pingo.backend.place.dto.response.PlaceExitRecommendationIdResponse;
import com.pingo.backend.place.dto.response.PlaceExitRecommendationResponse;
import com.pingo.backend.place.repository.NearbyPlaceRepository;
import com.pingo.backend.place.repository.PlaceExitRecommendationRepository;
import com.pingo.backend.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 주변 장소 및 장소-출구 추천 관리자 서비스. 좌표는 실외 GPS·관리자 입력값을 그대로 저장하며 서버에서 계산하지 않는다.
 * 단건 장소 조회/수정/삭제와 추천 등록은 모두 활성(is_active=true) 장소만 대상으로 한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AdminPlaceService {

    private final NearbyPlaceRepository nearbyPlaceRepository;
    private final PlaceExitRecommendationRepository placeExitRecommendationRepository;
    private final StationRepository stationRepository;
    private final FacilityRepository facilityRepository;

    // ---------- 주변 장소 ----------

    @Transactional
    public NearbyPlaceIdResponse createPlace(NearbyPlaceCreateRequest request) {
        validateStationActive(request.stationId());

        NearbyPlace place = NearbyPlace.create(
                request.stationId(),
                trim(request.nameKo()),
                trimToNull(request.nameEn()),
                trim(request.category()),
                trimToNull(request.address()),
                request.latitude(),
                request.longitude(),
                trimToNull(request.externalMapUrl())
        );

        return new NearbyPlaceIdResponse(nearbyPlaceRepository.save(place).getId());
    }

    public List<NearbyPlaceResponse> getPlaces(Long stationId) {
        requireStationId(stationId);
        validateStationActive(stationId);

        return nearbyPlaceRepository.findAllByStationIdOrderByNameKoAsc(stationId).stream()
                .map(NearbyPlaceResponse::from)
                .toList();
    }

    public NearbyPlaceResponse getPlace(Long placeId) {
        return NearbyPlaceResponse.from(getActivePlaceEntity(placeId));
    }

    @Transactional
    public NearbyPlaceResponse updatePlace(Long placeId, NearbyPlaceUpdateRequest request) {
        NearbyPlace place = getActivePlaceEntity(placeId);
        place.update(
                trim(request.nameKo()),
                trimToNull(request.nameEn()),
                trim(request.category()),
                trimToNull(request.address()),
                request.latitude(),
                request.longitude(),
                trimToNull(request.externalMapUrl())
        );
        return NearbyPlaceResponse.from(place);
    }

    @Transactional
    public void deletePlace(Long placeId) {
        NearbyPlace place = getActivePlaceEntity(placeId);
        place.deactivate();
        placeExitRecommendationRepository.deleteAllByPlaceId(placeId);
    }

    // ---------- 장소-출구 추천 ----------

    @Transactional
    public PlaceExitRecommendationIdResponse createRecommendation(PlaceExitRecommendationCreateRequest request) {
        NearbyPlace place = getActivePlaceEntity(request.placeId());
        validateExitFacility(request.exitFacilityId(), place.getStationId());

        if (placeExitRecommendationRepository.existsByPlaceIdAndExitFacilityId(request.placeId(), request.exitFacilityId())) {
            throw new BusinessException(ErrorCode.DUPLICATE_EXIT_RECOMMENDATION);
        }

        boolean primary = Boolean.TRUE.equals(request.isPrimary());
        if (primary) {
            placeExitRecommendationRepository.findAllByPlaceIdAndPrimaryTrue(request.placeId())
                    .forEach(PlaceExitRecommendation::unsetPrimary);
        }

        PlaceExitRecommendation recommendation = PlaceExitRecommendation.create(
                request.placeId(),
                request.exitFacilityId(),
                request.priority(),
                trimToNull(request.reasonKo()),
                trimToNull(request.reasonEn()),
                request.walkingTimeMin(),
                primary
        );

        return new PlaceExitRecommendationIdResponse(placeExitRecommendationRepository.save(recommendation).getId());
    }

    public List<PlaceExitRecommendationResponse> getRecommendations(Long placeId) {
        requirePlaceId(placeId);
        getActivePlaceEntity(placeId);

        return placeExitRecommendationRepository.findAllByPlaceIdOrderByPriorityAscIdAsc(placeId).stream()
                .map(PlaceExitRecommendationResponse::from)
                .toList();
    }

    @Transactional
    public void deleteRecommendation(Long recommendationId) {
        PlaceExitRecommendation recommendation = placeExitRecommendationRepository.findById(recommendationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.EXIT_RECOMMENDATION_NOT_FOUND));
        placeExitRecommendationRepository.delete(recommendation);
    }

    // ---------- helpers ----------

    private void validateExitFacility(Long facilityId, Long placeStationId) {
        Facility facility = facilityRepository.findByIdAndActiveTrue(facilityId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FACILITY_NOT_FOUND));
        if (!FacilityType.EXIT.getCode().equals(facility.getFacilityType())) {
            throw new BusinessException(ErrorCode.UNSUPPORTED_FACILITY_TYPE);
        }
        if (!facility.getStationId().equals(placeStationId)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
    }

    private NearbyPlace getActivePlaceEntity(Long placeId) {
        return nearbyPlaceRepository.findByIdAndActiveTrue(placeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PLACE_NOT_FOUND));
    }

    private void requireStationId(Long stationId) {
        if (stationId == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
    }

    private void requirePlaceId(Long placeId) {
        if (placeId == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
    }

    private void validateStationActive(Long stationId) {
        if (stationRepository.findByIdAndActiveTrue(stationId).isEmpty()) {
            throw new BusinessException(ErrorCode.STATION_NOT_FOUND);
        }
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
