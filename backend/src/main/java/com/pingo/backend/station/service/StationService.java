package com.pingo.backend.station.service;

import com.pingo.backend.externalmap.client.KakaoLocalClient;
import com.pingo.backend.externalmap.client.KakaoPlaceSearchResult;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class StationService {

    /** 환승역 노선을 한 줄로 합칠 때 쓰는 구분자. 예: "2호선·수인분당선" */
    private static final String LINE_DELIMITER = "·";

    private final StationRepository stationRepository;
    private final StationFloorRepository stationFloorRepository;
    private final KakaoLocalClient kakaoLocalClient;

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
     * 역을 검색한다.
     *
     * 등록된 역을 먼저 담고, 이어서 카카오 지하철역 검색 결과를 붙인다. 등록된 역이 아직
     * 역삼역 하나뿐이라 DB만 조회하면 다른 역 이름은 "결과 없음"으로 보이기 때문이다.
     * 외부 결과는 serviceReady=false 로 내려가고 실내 안내 대상이 아니다.
     *
     * keyword가 없으면 등록된 역 전체를 반환한다. 상담자 회원가입처럼 담당 역을 고르는 화면은
     * 검색어 없이 선택 목록만 필요하고, 이때는 외부 검색을 하지 않는다.
     */
    public List<StationSearchResponse> searchStations(String keyword) {
        String normalizedKeyword = trimToNull(keyword);

        if (normalizedKeyword == null) {
            return stationRepository.findAllByActiveTrueOrderByNameKoAsc().stream()
                    .map(StationSearchResponse::from)
                    .toList();
        }

        List<StationSearchResponse> results = stationRepository.searchActiveByKeyword(normalizedKeyword).stream()
                .map(StationSearchResponse::from)
                .collect(Collectors.toCollection(ArrayList::new));

        appendExternalStations(results, normalizedKeyword);

        return results;
    }

    private void appendExternalStations(List<StationSearchResponse> results, String keyword) {
        Set<String> registeredNames = results.stream()
                .map(StationSearchResponse::nameKo)
                .collect(Collectors.toSet());

        groupByStationName(searchExternalStations(keyword)).forEach((stationName, group) -> {
            if (registeredNames.contains(stationName) || !nameMatchesKeyword(stationName, keyword)) {
                return;
            }
            results.add(StationSearchResponse.fromKakaoStation(stationName, lineInfoOf(group), group.get(0)));
        });
    }

    /**
     * 카카오 키워드 검색은 검색어를 지역으로도 해석해서 "사당"에 이수역·남성역까지 끼워 준다.
     * 역 이름 검색이므로 이름에 검색어가 실제로 들어간 역만 남긴다.
     */
    private boolean nameMatchesKeyword(String stationName, String keyword) {
        return stationName.toLowerCase(Locale.ROOT).contains(keyword.toLowerCase(Locale.ROOT));
    }

    private List<KakaoPlaceSearchResult> searchExternalStations(String keyword) {
        try {
            return kakaoLocalClient.searchSubwayStations(keyword);
        } catch (BusinessException exception) {
            if (exception.getErrorCode() != ErrorCode.EXTERNAL_PLACE_SEARCH_FAILED) {
                throw exception;
            }
            log.warn("카카오 지하철역 검색에 실패해 등록된 역만 반환합니다. keyword={}", keyword);
            return List.of();
        }
    }

    /** 카카오는 환승역을 노선별로 따로 내려주므로 역 이름으로 묶는다. */
    private Map<String, List<KakaoPlaceSearchResult>> groupByStationName(List<KakaoPlaceSearchResult> places) {
        return places.stream().collect(Collectors.groupingBy(
                place -> SubwayPlaceName.parse(place.name()).stationName(),
                LinkedHashMap::new,
                Collectors.toList()
        ));
    }

    private String lineInfoOf(List<KakaoPlaceSearchResult> group) {
        return trimToNull(group.stream()
                .map(place -> SubwayPlaceName.parse(place.name()).line())
                .filter(line -> !line.isBlank())
                .distinct()
                .collect(Collectors.joining(LINE_DELIMITER)));
    }

    /**
     * 카카오 지하철역 이름을 역 이름과 노선으로 나눈 결과.
     *
     * 카카오는 "선릉역 2호선", "서울역 공항철도" 처럼 역 이름 뒤에 노선을 붙여 내려준다.
     * 노선 표기가 없으면 이름 전체가 역 이름이다.
     */
    private record SubwayPlaceName(String stationName, String line) {

        private static final String STATION_NAME_SUFFIX = "역";

        private static SubwayPlaceName parse(String placeName) {
            String trimmed = placeName.trim();
            int lastSpace = trimmed.lastIndexOf(' ');

            if (lastSpace < 0) {
                return new SubwayPlaceName(trimmed, "");
            }

            String head = trimmed.substring(0, lastSpace).trim();
            // 역 이름은 반드시 "역"으로 끝난다. 아니면 노선 표기가 아니라 이름의 일부다.
            if (!head.endsWith(STATION_NAME_SUFFIX)) {
                return new SubwayPlaceName(trimmed, "");
            }

            return new SubwayPlaceName(head, trimmed.substring(lastSpace + 1).trim());
        }
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
                request.floorOrder(),
                request.nominalZ()
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

        floor.update(floorCode, trimToNull(request.floorName()), request.floorOrder(), request.nominalZ());

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
