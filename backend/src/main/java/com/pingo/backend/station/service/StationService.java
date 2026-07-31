package com.pingo.backend.station.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.geo.GeoDistanceCalculator;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.dto.request.FloorCreateRequest;
import com.pingo.backend.station.dto.request.FloorUpdateRequest;
import com.pingo.backend.station.dto.request.StationCreateRequest;
import com.pingo.backend.station.dto.request.StationUpdateRequest;
import com.pingo.backend.station.dto.response.FloorIdResponse;
import com.pingo.backend.station.dto.response.FloorResponse;
import com.pingo.backend.station.dto.response.StationDetailResponse;
import com.pingo.backend.station.dto.response.StationIdResponse;
import com.pingo.backend.station.dto.response.StationNearbyResponse;
import com.pingo.backend.station.dto.response.StationResponse;
import com.pingo.backend.station.dto.response.StationSearchResponse;
import com.pingo.backend.station.repository.StationFloorRepository;
import com.pingo.backend.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StationService {

    private final StationRepository stationRepository;
    private final StationFloorRepository stationFloorRepository;

    @Transactional
    public StationIdResponse createStation(StationCreateRequest request) {
        Station station = Station.create(
                request.nameKo().trim(),
                request.nameEn().trim(),
                trimToNull(request.lineInfo()),
                request.latitude(),
                request.longitude()
        );

        Station savedStation = stationRepository.save(station);
        return new StationIdResponse(savedStation.getId());
    }

    public List<StationResponse> getStations() {
        return stationRepository.findAllByActiveTrueOrderByNameKoAsc().stream()
                .map(StationResponse::from)
                .toList();
    }

    public List<StationSearchResponse> searchStations(String keyword) {
        String normalizedKeyword = trimToNull(keyword);
        if (normalizedKeyword == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }

        return stationRepository.searchActiveByKeyword(normalizedKeyword).stream()
                .map(StationSearchResponse::from)
                .toList();
    }

    public List<StationNearbyResponse> getNearbyStations(Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }

        return stationRepository.findAllByActiveTrueAndLatitudeIsNotNullAndLongitudeIsNotNull().stream()
                .map(station -> StationNearbyResponse.of(
                        station,
                        GeoDistanceCalculator.distanceMeters(
                                java.math.BigDecimal.valueOf(latitude),
                                java.math.BigDecimal.valueOf(longitude),
                                station.getLatitude(),
                                station.getLongitude()
                        )
                ))
                .sorted(Comparator.comparingLong(StationNearbyResponse::distanceM))
                .toList();
    }

    public StationDetailResponse getStation(Long stationId) {
        Station station = getActiveStation(stationId);
        List<FloorResponse> floors = getFloorResponses(stationId);

        return StationDetailResponse.of(station, floors);
    }

    @Transactional
    public StationDetailResponse updateStation(Long stationId, StationUpdateRequest request) {
        Station station = getActiveStation(stationId);
        station.update(
                request.nameKo().trim(),
                request.nameEn().trim(),
                trimToNull(request.lineInfo()),
                request.latitude(),
                request.longitude()
        );

        return StationDetailResponse.of(station, getFloorResponses(stationId));
    }

    @Transactional
    public void deleteStation(Long stationId) {
        getActiveStation(stationId).deactivate();
    }

    @Transactional
    public FloorIdResponse createFloor(Long stationId, FloorCreateRequest request) {
        Station station = getActiveStation(stationId);
        String floorCode = normalizeFloorCode(request.floorCode());
        validateDuplicateFloorCode(stationId, floorCode);

        StationFloor floor = StationFloor.create(
                station,
                floorCode,
                trimToNull(request.floorName()),
                request.floorOrder()
        );

        try {
            StationFloor savedFloor = stationFloorRepository.saveAndFlush(floor);
            return new FloorIdResponse(savedFloor.getId());
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ErrorCode.DUPLICATE_FLOOR_CODE);
        }
    }

    public List<FloorResponse> getFloors(Long stationId) {
        getActiveStation(stationId);
        return getFloorResponses(stationId);
    }

    @Transactional
    public FloorResponse updateFloor(Long floorId, FloorUpdateRequest request) {
        StationFloor floor = getFloor(floorId);
        Long stationId = floor.getStation().getId();
        String floorCode = normalizeFloorCode(request.floorCode());

        if (stationFloorRepository.existsByStationIdAndFloorCodeAndIdNot(stationId, floorCode, floorId)) {
            throw new BusinessException(ErrorCode.DUPLICATE_FLOOR_CODE);
        }

        floor.update(floorCode, trimToNull(request.floorName()), request.floorOrder());

        try {
            stationFloorRepository.flush();
            return FloorResponse.from(floor);
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ErrorCode.DUPLICATE_FLOOR_CODE);
        }
    }

    @Transactional
    public void deleteFloor(Long floorId) {
        StationFloor floor = getFloor(floorId);

        try {
            stationFloorRepository.delete(floor);
            stationFloorRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ErrorCode.FLOOR_IN_USE);
        }
    }

    private Station getActiveStation(Long stationId) {
        return stationRepository.findByIdAndActiveTrue(stationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.STATION_NOT_FOUND));
    }

    private StationFloor getFloor(Long floorId) {
        StationFloor floor = stationFloorRepository.findById(floorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FLOOR_NOT_FOUND));

        if (!floor.getStation().isActive()) {
            throw new BusinessException(ErrorCode.FLOOR_NOT_FOUND);
        }

        return floor;
    }

    private List<FloorResponse> getFloorResponses(Long stationId) {
        return stationFloorRepository.findAllByStationIdOrderByFloorOrderAsc(stationId).stream()
                .map(FloorResponse::from)
                .toList();
    }

    private void validateDuplicateFloorCode(Long stationId, String floorCode) {
        if (stationFloorRepository.existsByStationIdAndFloorCode(stationId, floorCode)) {
            throw new BusinessException(ErrorCode.DUPLICATE_FLOOR_CODE);
        }
    }

    private String normalizeFloorCode(String floorCode) {
        return floorCode.trim().toUpperCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
