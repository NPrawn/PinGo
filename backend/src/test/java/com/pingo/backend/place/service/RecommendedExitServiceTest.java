package com.pingo.backend.place.service;

import com.pingo.backend.facility.domain.ExitDetail;
import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.repository.ExitDetailRepository;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.place.domain.NearbyPlace;
import com.pingo.backend.place.domain.PlaceExitRecommendation;
import com.pingo.backend.place.dto.response.RecommendedExitResponse;
import com.pingo.backend.place.repository.NearbyPlaceRepository;
import com.pingo.backend.place.repository.PlaceExitRecommendationRepository;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecommendedExitServiceTest {

    @Mock
    private PlaceExitRecommendationRepository recommendationRepository;

    @Mock
    private NearbyPlaceRepository nearbyPlaceRepository;

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private ExitDetailRepository exitDetailRepository;

    private RecommendedExitService recommendedExitService;

    @BeforeEach
    void setUp() {
        recommendedExitService = new RecommendedExitService(
                recommendationRepository, nearbyPlaceRepository, facilityRepository, exitDetailRepository);
    }

    @Test
    void getRecommendedExitsReturnsRecommendationWithExitLocation() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(createPlace(3L)));
        when(recommendationRepository.findAllByPlaceIdOrderByPriorityAscIdAsc(3L))
                .thenReturn(List.of(createRecommendation(1L, 3L, 10L, 1, true)));
        when(facilityRepository.findByIdAndActiveTrue(10L)).thenReturn(Optional.of(createExitFacility(10L)));
        when(exitDetailRepository.findByFacilityId(10L)).thenReturn(Optional.of(
                ExitDetail.create(10L, "5", new BigDecimal("37.4982"), new BigDecimal("127.0281"), null, null)));

        List<RecommendedExitResponse> results = recommendedExitService.getRecommendedExits(3L);

        assertThat(results).hasSize(1);
        RecommendedExitResponse response = results.get(0);
        assertThat(response.exitFacilityId()).isEqualTo(10L);
        assertThat(response.exitNameKo()).isEqualTo("5번 출구");
        assertThat(response.isPrimary()).isTrue();
        assertThat(response.exitLocation().latitude()).isEqualByComparingTo("37.4982");
    }

    @Test
    void getRecommendedExitsSkipsInactiveExitFacility() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(createPlace(3L)));
        when(recommendationRepository.findAllByPlaceIdOrderByPriorityAscIdAsc(3L))
                .thenReturn(List.of(createRecommendation(1L, 3L, 10L, 1, true)));
        when(facilityRepository.findByIdAndActiveTrue(10L)).thenReturn(Optional.empty());

        List<RecommendedExitResponse> results = recommendedExitService.getRecommendedExits(3L);

        assertThat(results).isEmpty();
    }

    @Test
    void getRecommendedExitsThrowsWhenPlaceNotFound() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> recommendedExitService.getRecommendedExits(99L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PLACE_NOT_FOUND));
    }

    private NearbyPlace createPlace(Long id) {
        NearbyPlace place = NearbyPlace.create(
                1L, "코엑스몰", "COEX Mall", "shopping", null, null, null, null);
        ReflectionTestUtils.setField(place, "id", id);
        return place;
    }

    private PlaceExitRecommendation createRecommendation(Long id, Long placeId, Long exitFacilityId, int priority, boolean primary) {
        PlaceExitRecommendation recommendation = PlaceExitRecommendation.create(
                placeId, exitFacilityId, priority, "가장 가까운 출구", "Closest exit", 6, primary);
        ReflectionTestUtils.setField(recommendation, "id", id);
        return recommendation;
    }

    private Facility createExitFacility(Long id) {
        Facility facility = Facility.create(
                1L, 1L, "exit", "5번 출구", "Exit 5",
                new BigDecimal("820.4"), new BigDecimal("120.7"), null, true);
        ReflectionTestUtils.setField(facility, "id", id);
        return facility;
    }
}
