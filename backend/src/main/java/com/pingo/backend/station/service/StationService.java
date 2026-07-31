package com.pingo.backend.station.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
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

    /**
     * 서비스 중인 역을 검색한다.
     *
     * keyword가 없으면 전체 목록을 반환한다. 상담자 회원가입처럼 담당 역을 고르는 화면은
     * 검색어 없이 선택 목록만 필요하다.
     */
    public List<StationSearchResponse> searchStations(String keyword) {
        String normalizedKeyword = trimToNull(keyword);
        List<Station> stations = normalizedKeyword == null
                ? stationRepository.findAllByActiveTrueOrderByNameKoAsc()
                : stationRepository.searchActiveByKeyword(normalizedKeyword);

        return stations.stream()
                .map(StationSearchResponse::from)
                .toList();
    }

    public List<StationNearbyResponse> getNearbyStations(Double latitude, Double longitude) {
        if (latitude == null || longitude == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }

        return stationRepository.findAllByActiveTrueAndLatitudeIsNotNullAndLongitudeIsNotNull().stream()
                .map(station -> StationNearbyResponse.of(station, distanceMeters(latitude, longitude, station)))
                .sorted(Comparator.comparingLong(StationNearbyResponse::distanceM))
                .toList();
    }

    // 두 좌표 사이의 대권 거리를 Haversine 공식으로 계산해 미터 단위로 반환한다.
    private long distanceMeters(double latitude, double longitude, Station station) {
        double earthRadiusMeters = 6_371_000.0;
        double stationLatitude = station.getLatitude().doubleValue();
        double stationLongitude = station.getLongitude().doubleValue();

        double latitudeDelta = Math.toRadians(stationLatitude - latitude);
        double longitudeDelta = Math.toRadians(stationLongitude - longitude);
        double a = Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2)
                + Math.cos(Math.toRadians(latitude)) * Math.cos(Math.toRadians(stationLatitude))
                * Math.sin(longitudeDelta / 2) * Math.sin(longitudeDelta / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(earthRadiusMeters * c);
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
