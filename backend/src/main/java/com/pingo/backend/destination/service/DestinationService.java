package com.pingo.backend.destination.service;

import com.pingo.backend.destination.dto.response.DestinationSearchResponse;
import com.pingo.backend.externalmap.client.KakaoLocalClient;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.place.repository.NearbyPlaceRepository;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DestinationService {

    private final FacilityRepository facilityRepository;
    private final NearbyPlaceRepository nearbyPlaceRepository;
    private final StationRepository stationRepository;
    private final KakaoLocalClient kakaoLocalClient;

    /**
     * 역 내부 시설과 역 주변 장소를 이름 키워드로 통합 검색한다.
     * 응답은 시설(facility) 먼저, 이어서 주변 장소(place) 순으로 반환한다.
     */
    public List<DestinationSearchResponse> search(Long stationId, String keyword) {
        if (stationId == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        String normalizedKeyword = normalizeKeyword(keyword);
        Station station = getActiveStation(stationId);

        List<DestinationSearchResponse> results = new ArrayList<>();

        facilityRepository.searchActiveByKeyword(stationId, normalizedKeyword).stream()
                .map(DestinationSearchResponse::fromFacility)
                .forEach(results::add);

        nearbyPlaceRepository.searchActiveByKeyword(stationId, normalizedKeyword).stream()
                .map(DestinationSearchResponse::fromPlace)
                .forEach(results::add);

        if (station.getLatitude() != null && station.getLongitude() != null) {
            kakaoLocalClient.searchPlaces(normalizedKeyword, station.getLongitude(), station.getLatitude()).stream()
                    .map(DestinationSearchResponse::fromKakaoPlace)
                    .forEach(results::add);
        }

        return results;
    }

    private Station getActiveStation(Long stationId) {
        return stationRepository.findByIdAndActiveTrue(stationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.STATION_NOT_FOUND));
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null || keyword.isBlank()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        return keyword.trim();
    }
}
