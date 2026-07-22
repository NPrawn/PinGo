package com.pingo.backend.facility.service;

import com.pingo.backend.facility.domain.ExitDetail;
import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.domain.FacilityType;
import com.pingo.backend.facility.dto.request.ExitDetailRequest;
import com.pingo.backend.facility.dto.request.FacilityCreateRequest;
import com.pingo.backend.facility.dto.request.FacilityUpdateRequest;
import com.pingo.backend.facility.dto.response.ExitDetailResponse;
import com.pingo.backend.facility.dto.response.FacilityDetailResponse;
import com.pingo.backend.facility.dto.response.FacilityIdResponse;
import com.pingo.backend.facility.dto.response.FacilityResponse;
import com.pingo.backend.facility.repository.ExitDetailRepository;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import com.pingo.backend.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class FacilityService {

    private static final String EXIT_TYPE = "exit";

    private final FacilityRepository facilityRepository;
    private final ExitDetailRepository exitDetailRepository;
    private final StationRepository stationRepository;
    private final StationFloorRepository stationFloorRepository;

    @Transactional
    public FacilityIdResponse createFacility(FacilityCreateRequest request) {
        validateStationAndFloor(request.stationId(), request.floorId());
        String facilityType = normalizeFacilityType(request.facilityType());

        Facility facility = Facility.create(
                request.stationId(),
                request.floorId(),
                facilityType,
                request.nameKo().trim(),
                trimToNull(request.nameEn()),
                request.mapX(),
                request.mapY(),
                request.linkedNodeId(),
                Boolean.TRUE.equals(request.isAccessible())
        );
        Facility savedFacility = facilityRepository.save(facility);

        if (EXIT_TYPE.equals(facilityType) && request.exitDetail() != null) {
            exitDetailRepository.save(toExitDetail(savedFacility.getId(), request.exitDetail()));
        }

        return new FacilityIdResponse(savedFacility.getId());
    }

    public List<FacilityResponse> getFacilities(Long stationId, Long floorId, String facilityType) {
        getActiveStation(stationId);

        return facilityRepository.searchActive(stationId, floorId, normalizeNullableType(facilityType)).stream()
                .map(FacilityResponse::from)
                .toList();
    }

    public FacilityDetailResponse getFacility(Long facilityId) {
        Facility facility = getActiveFacility(facilityId);
        return FacilityDetailResponse.of(facility, findExitDetailResponse(facility));
    }

    @Transactional
    public FacilityDetailResponse updateFacility(Long facilityId, FacilityUpdateRequest request) {
        Facility facility = getActiveFacility(facilityId);
        String facilityType = normalizeFacilityType(request.facilityType());

        facility.update(
                facilityType,
                request.nameKo().trim(),
                trimToNull(request.nameEn()),
                request.mapX(),
                request.mapY(),
                request.linkedNodeId(),
                Boolean.TRUE.equals(request.isAccessible())
        );

        reconcileExitDetail(facilityId, facilityType, request.exitDetail());

        return FacilityDetailResponse.of(facility, findExitDetailResponse(facility));
    }

    @Transactional
    public void deleteFacility(Long facilityId) {
        getActiveFacility(facilityId).deactivate();
    }

    private void reconcileExitDetail(Long facilityId, String facilityType, ExitDetailRequest request) {
        if (!EXIT_TYPE.equals(facilityType)) {
            exitDetailRepository.deleteByFacilityId(facilityId);
            return;
        }

        if (request == null) {
            return;
        }

        exitDetailRepository.findByFacilityId(facilityId).ifPresentOrElse(
                existing -> existing.update(
                        request.exitNumber().trim(),
                        request.outsideLatitude(),
                        request.outsideLongitude(),
                        trimToNull(request.descriptionKo()),
                        trimToNull(request.descriptionEn())
                ),
                () -> exitDetailRepository.save(toExitDetail(facilityId, request))
        );
    }

    private ExitDetail toExitDetail(Long facilityId, ExitDetailRequest request) {
        return ExitDetail.create(
                facilityId,
                request.exitNumber().trim(),
                request.outsideLatitude(),
                request.outsideLongitude(),
                trimToNull(request.descriptionKo()),
                trimToNull(request.descriptionEn())
        );
    }

    private ExitDetailResponse findExitDetailResponse(Facility facility) {
        if (!facility.isExit()) {
            return null;
        }
        return exitDetailRepository.findByFacilityId(facility.getId())
                .map(ExitDetailResponse::from)
                .orElse(null);
    }

    private void validateStationAndFloor(Long stationId, Long floorId) {
        getActiveStation(stationId);

        StationFloor floor = stationFloorRepository.findById(floorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FLOOR_NOT_FOUND));
        if (!floor.getStation().getId().equals(stationId)) {
            throw new BusinessException(ErrorCode.FLOOR_NOT_FOUND);
        }
    }

    private void getActiveStation(Long stationId) {
        if (stationRepository.findByIdAndActiveTrue(stationId).isEmpty()) {
            throw new BusinessException(ErrorCode.STATION_NOT_FOUND);
        }
    }

    private Facility getActiveFacility(Long facilityId) {
        return facilityRepository.findByIdAndActiveTrue(facilityId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FACILITY_NOT_FOUND));
    }

    private String normalizeFacilityType(String facilityType) {
        return FacilityType.fromCode(facilityType)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNSUPPORTED_FACILITY_TYPE))
                .getCode();
    }

    private String normalizeNullableType(String facilityType) {
        String normalized = trimToNull(facilityType);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
