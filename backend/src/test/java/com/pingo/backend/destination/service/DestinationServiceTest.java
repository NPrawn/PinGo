package com.pingo.backend.destination.service;

import com.pingo.backend.destination.dto.response.DestinationSearchResponse;
import com.pingo.backend.externalmap.client.KakaoLocalClient;
import com.pingo.backend.externalmap.client.KakaoPlaceSearchResult;
import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.place.domain.NearbyPlace;
import com.pingo.backend.place.repository.NearbyPlaceRepository;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DestinationServiceTest {

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private NearbyPlaceRepository nearbyPlaceRepository;

    @Mock
    private StationRepository stationRepository;

    @Mock
    private KakaoLocalClient kakaoLocalClient;

    private DestinationService destinationService;

    @BeforeEach
    void setUp() {
        destinationService = new DestinationService(
                facilityRepository,
                nearbyPlaceRepository,
                stationRepository,
                kakaoLocalClient
        );
    }

    @Test
    void searchMergesFacilitiesThenPlaces() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(createStation(1L)));
        when(facilityRepository.searchActiveByKeyword(1L, "출구")).thenReturn(List.of(createExitFacility(10L)));
        when(nearbyPlaceRepository.searchActiveByKeyword(1L, "출구")).thenReturn(List.of(createPlace(3L)));
        when(kakaoLocalClient.searchPlaces(
                "출구",
                new BigDecimal("127.0365000"),
                new BigDecimal("37.5007000")
        )).thenReturn(List.of(new KakaoPlaceSearchResult(
                "18577297",
                "강남파이낸스센터",
                "서비스,산업 > 기업",
                "서울 강남구 테헤란로 152",
                new BigDecimal("37.500029"),
                new BigDecimal("127.036431"),
                75L
        )));

        List<DestinationSearchResponse> results = destinationService.search(1L, "  출구  ");

        assertThat(results)
                .extracting(
                        DestinationSearchResponse::destinationType,
                        DestinationSearchResponse::destinationId,
                        DestinationSearchResponse::category
                )
                .containsExactly(
                        tuple("facility", 10L, "exit"),
                        tuple("place", 3L, "shopping"),
                        tuple("external_place", null, "서비스,산업 > 기업"));

        DestinationSearchResponse externalPlace = results.get(2);
        assertThat(externalPlace.externalId()).isEqualTo("18577297");
        assertThat(externalPlace.latitude()).isEqualByComparingTo("37.500029");
        assertThat(externalPlace.longitude()).isEqualByComparingTo("127.036431");
    }

    @Test
    void searchReturnsLocalResultsWhenKakaoSearchFails() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(createStation(1L)));
        when(facilityRepository.searchActiveByKeyword(1L, "출구")).thenReturn(List.of(createExitFacility(10L)));
        when(nearbyPlaceRepository.searchActiveByKeyword(1L, "출구")).thenReturn(List.of(createPlace(3L)));
        when(kakaoLocalClient.searchPlaces(
                "출구",
                new BigDecimal("127.0365000"),
                new BigDecimal("37.5007000")
        )).thenThrow(new BusinessException(ErrorCode.EXTERNAL_PLACE_SEARCH_FAILED));

        List<DestinationSearchResponse> results = destinationService.search(1L, "출구");

        assertThat(results)
                .extracting(
                        DestinationSearchResponse::destinationType,
                        DestinationSearchResponse::destinationId
                )
                .containsExactly(
                        tuple("facility", 10L),
                        tuple("place", 3L)
                );
    }

    @Test
    void searchThrowsWhenStationIdIsNull() {
        assertThatThrownBy(() -> destinationService.search(null, "출구"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
        verify(facilityRepository, never()).searchActiveByKeyword(any(), any());
    }

    @Test
    void searchThrowsWhenKeywordIsBlank() {
        assertThatThrownBy(() -> destinationService.search(1L, "   "))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
        verify(facilityRepository, never()).searchActiveByKeyword(any(), any());
    }

    @Test
    void searchThrowsWhenStationNotFound() {
        when(stationRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> destinationService.search(99L, "출구"))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATION_NOT_FOUND));
    }

    private Station createStation(Long id) {
        Station station = Station.create(
                "역삼역", "Yeoksam Station", "2호선",
                new BigDecimal("37.5007000"), new BigDecimal("127.0365000"));
        ReflectionTestUtils.setField(station, "id", id);
        return station;
    }

    private Facility createExitFacility(Long id) {
        Facility facility = Facility.create(
                1L, 2L, "exit", "5번 출구", "Exit 5",
                new BigDecimal("820.4"), new BigDecimal("120.7"), null, true);
        ReflectionTestUtils.setField(facility, "id", id);
        return facility;
    }

    private NearbyPlace createPlace(Long id) {
        NearbyPlace place = NearbyPlace.create(
                1L, "코엑스몰", "COEX Mall", "shopping",
                "서울특별시 강남구 영동대로 513",
                new BigDecimal("37.5118000"), new BigDecimal("127.0592000"), null);
        ReflectionTestUtils.setField(place, "id", id);
        return place;
    }
}
