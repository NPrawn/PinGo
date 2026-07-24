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
import com.pingo.backend.place.dto.response.PlaceExitRecommendationResponse;
import com.pingo.backend.place.repository.NearbyPlaceRepository;
import com.pingo.backend.place.repository.PlaceExitRecommendationRepository;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminPlaceServiceTest {

    @Mock
    private NearbyPlaceRepository nearbyPlaceRepository;

    @Mock
    private PlaceExitRecommendationRepository placeExitRecommendationRepository;

    @Mock
    private StationRepository stationRepository;

    @Mock
    private FacilityRepository facilityRepository;

    private AdminPlaceService adminPlaceService;

    @BeforeEach
    void setUp() {
        adminPlaceService = new AdminPlaceService(
                nearbyPlaceRepository, placeExitRecommendationRepository, stationRepository, facilityRepository);
    }

    // ---------- 주변 장소 ----------

    @Test
    @DisplayName("주변 장소를 등록하면 생성된 ID를 반환한다")
    void createPlaceReturnsId() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station(1L)));
        when(nearbyPlaceRepository.save(any())).thenReturn(place(10L, 1L));

        NearbyPlaceIdResponse response = adminPlaceService.createPlace(
                new NearbyPlaceCreateRequest(1L, "코엑스몰", "COEX Mall", "shopping",
                        "서울 강남구", new BigDecimal("37.5118"), new BigDecimal("127.0592"), null));

        assertThat(response.placeId()).isEqualTo(10L);
    }

    @Test
    @DisplayName("존재하지 않는 역에 장소를 등록하면 예외가 발생한다")
    void createPlaceRejectsUnknownStation() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminPlaceService.createPlace(
                new NearbyPlaceCreateRequest(1L, "코엑스몰", null, "shopping", null, null, null, null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATION_NOT_FOUND));
    }

    @Test
    @DisplayName("역별 장소 목록은 비활성 장소도 포함해 조회한다")
    void getPlacesReturnsAll() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station(1L)));
        NearbyPlace inactive = place(11L, 1L);
        inactive.deactivate();
        when(nearbyPlaceRepository.findAllByStationIdOrderByNameKoAsc(1L))
                .thenReturn(List.of(place(10L, 1L), inactive));

        List<NearbyPlaceResponse> places = adminPlaceService.getPlaces(1L);

        assertThat(places).extracting(NearbyPlaceResponse::placeId).containsExactly(10L, 11L);
        assertThat(places).extracting(NearbyPlaceResponse::active).containsExactly(true, false);
    }

    @Test
    @DisplayName("stationId 없이 장소 목록을 조회하면 예외가 발생한다")
    void getPlacesRejectsNullStationId() {
        assertThatThrownBy(() -> adminPlaceService.getPlaces(null))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
    }

    @Test
    @DisplayName("존재하지 않거나 비활성인 장소를 조회하면 예외가 발생한다")
    void getPlaceNotFound() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminPlaceService.getPlace(99L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PLACE_NOT_FOUND));
    }

    @Test
    @DisplayName("주변 장소를 수정하면 필드가 갱신된다")
    void updatePlaceChangesFields() {
        NearbyPlace place = place(10L, 1L);
        when(nearbyPlaceRepository.findByIdAndActiveTrue(10L)).thenReturn(Optional.of(place));

        NearbyPlaceResponse response = adminPlaceService.updatePlace(10L,
                new NearbyPlaceUpdateRequest("스타필드", "Starfield", "shopping", "하남시", null, null, null));

        assertThat(response.nameKo()).isEqualTo("스타필드");
        assertThat(response.category()).isEqualTo("shopping");
    }

    @Test
    @DisplayName("존재하지 않거나 비활성인 장소를 수정하면 예외가 발생한다")
    void updatePlaceNotFound() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminPlaceService.updatePlace(99L,
                new NearbyPlaceUpdateRequest("스타필드", null, "shopping", null, null, null, null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PLACE_NOT_FOUND));
    }

    @Test
    @DisplayName("장소를 삭제하면 비활성화하고 연결된 추천을 함께 제거한다")
    void deletePlaceDeactivatesAndRemovesRecommendations() {
        NearbyPlace place = place(10L, 1L);
        when(nearbyPlaceRepository.findByIdAndActiveTrue(10L)).thenReturn(Optional.of(place));

        adminPlaceService.deletePlace(10L);

        assertThat(place.isActive()).isFalse();
        verify(placeExitRecommendationRepository).deleteAllByPlaceId(10L);
    }

    // ---------- 장소-출구 추천 ----------

    @Test
    @DisplayName("장소-출구 추천을 등록하면 생성된 ID를 반환한다")
    void createRecommendationReturnsId() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(place(3L, 1L)));
        when(facilityRepository.findByIdAndActiveTrue(10L))
                .thenReturn(Optional.of(facility(10L, 1L, FacilityType.EXIT.getCode())));
        when(placeExitRecommendationRepository.save(any())).thenReturn(recommendation(20L, 3L, 10L, true));

        var response = adminPlaceService.createRecommendation(
                new PlaceExitRecommendationCreateRequest(3L, 10L, 1, "가장 가까운 출구", null, 6, true));

        assertThat(response.recommendationId()).isEqualTo(20L);
    }

    @Test
    @DisplayName("존재하지 않거나 비활성인 장소에 추천을 등록하면 예외가 발생한다")
    void createRecommendationRejectsUnknownPlace() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminPlaceService.createRecommendation(
                new PlaceExitRecommendationCreateRequest(3L, 10L, 1, null, null, null, null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.PLACE_NOT_FOUND));
    }

    @Test
    @DisplayName("존재하지 않는 출구 시설을 추천하면 예외가 발생한다")
    void createRecommendationRejectsMissingFacility() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(place(3L, 1L)));
        when(facilityRepository.findByIdAndActiveTrue(10L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminPlaceService.createRecommendation(
                new PlaceExitRecommendationCreateRequest(3L, 10L, 1, null, null, null, null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FACILITY_NOT_FOUND));
    }

    @Test
    @DisplayName("출구가 아닌 시설을 추천하면 예외가 발생한다")
    void createRecommendationRejectsNonExitFacility() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(place(3L, 1L)));
        when(facilityRepository.findByIdAndActiveTrue(10L))
                .thenReturn(Optional.of(facility(10L, 1L, FacilityType.GATE.getCode())));

        assertThatThrownBy(() -> adminPlaceService.createRecommendation(
                new PlaceExitRecommendationCreateRequest(3L, 10L, 1, null, null, null, null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNSUPPORTED_FACILITY_TYPE));
    }

    @Test
    @DisplayName("장소와 다른 역의 출구를 추천하면 예외가 발생한다")
    void createRecommendationRejectsExitFromDifferentStation() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(place(3L, 1L)));
        when(facilityRepository.findByIdAndActiveTrue(10L))
                .thenReturn(Optional.of(facility(10L, 2L, FacilityType.EXIT.getCode())));

        assertThatThrownBy(() -> adminPlaceService.createRecommendation(
                new PlaceExitRecommendationCreateRequest(3L, 10L, 1, null, null, null, null)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
    }

    @Test
    @DisplayName("동일한 장소-출구 조합을 중복 등록하면 예외가 발생한다")
    void createRecommendationRejectsDuplicate() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(place(3L, 1L)));
        when(facilityRepository.findByIdAndActiveTrue(10L))
                .thenReturn(Optional.of(facility(10L, 1L, FacilityType.EXIT.getCode())));
        when(placeExitRecommendationRepository.existsByPlaceIdAndExitFacilityId(3L, 10L)).thenReturn(true);

        assertThatThrownBy(() -> adminPlaceService.createRecommendation(
                new PlaceExitRecommendationCreateRequest(3L, 10L, 1, null, null, null, false)))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DUPLICATE_EXIT_RECOMMENDATION));
    }

    @Test
    @DisplayName("대표 추천으로 등록하면 기존 대표 추천을 해제한다")
    void createRecommendationDemotesExistingPrimary() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(place(3L, 1L)));
        when(facilityRepository.findByIdAndActiveTrue(11L))
                .thenReturn(Optional.of(facility(11L, 1L, FacilityType.EXIT.getCode())));
        PlaceExitRecommendation existingPrimary = recommendation(20L, 3L, 10L, true);
        when(placeExitRecommendationRepository.findAllByPlaceIdAndPrimaryTrue(3L))
                .thenReturn(List.of(existingPrimary));
        when(placeExitRecommendationRepository.save(any())).thenReturn(recommendation(21L, 3L, 11L, true));

        adminPlaceService.createRecommendation(
                new PlaceExitRecommendationCreateRequest(3L, 11L, 1, null, null, null, true));

        assertThat(existingPrimary.isPrimary()).isFalse();
    }

    @Test
    @DisplayName("장소별 추천 목록을 우선순위 순으로 조회한다")
    void getRecommendationsReturnsList() {
        when(nearbyPlaceRepository.findByIdAndActiveTrue(3L)).thenReturn(Optional.of(place(3L, 1L)));
        when(placeExitRecommendationRepository.findAllByPlaceIdOrderByPriorityAscIdAsc(3L))
                .thenReturn(List.of(recommendation(20L, 3L, 10L, true)));

        List<PlaceExitRecommendationResponse> responses = adminPlaceService.getRecommendations(3L);

        assertThat(responses).extracting(PlaceExitRecommendationResponse::recommendationId).containsExactly(20L);
    }

    @Test
    @DisplayName("placeId 없이 추천 목록을 조회하면 예외가 발생한다")
    void getRecommendationsRejectsNullPlaceId() {
        assertThatThrownBy(() -> adminPlaceService.getRecommendations(null))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
    }

    @Test
    @DisplayName("존재하지 않는 추천을 삭제하면 예외가 발생한다")
    void deleteRecommendationNotFound() {
        when(placeExitRecommendationRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> adminPlaceService.deleteRecommendation(99L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.EXIT_RECOMMENDATION_NOT_FOUND));
    }

    @Test
    @DisplayName("추천을 삭제하면 저장소에서 제거한다")
    void deleteRecommendationRemoves() {
        PlaceExitRecommendation recommendation = recommendation(20L, 3L, 10L, true);
        when(placeExitRecommendationRepository.findById(20L)).thenReturn(Optional.of(recommendation));

        adminPlaceService.deleteRecommendation(20L);

        verify(placeExitRecommendationRepository).delete(recommendation);
    }

    // ---------- helpers ----------

    private Station station(long id) {
        Station station = Station.create("테스트역", "Test", "1호선", new BigDecimal("37.5"), new BigDecimal("127.0"));
        ReflectionTestUtils.setField(station, "id", id);
        return station;
    }

    private NearbyPlace place(long id, long stationId) {
        NearbyPlace place = NearbyPlace.create(stationId, "코엑스몰", "COEX Mall", "shopping",
                "서울 강남구", new BigDecimal("37.5118"), new BigDecimal("127.0592"), null);
        ReflectionTestUtils.setField(place, "id", id);
        return place;
    }

    private Facility facility(long id, long stationId, String facilityType) {
        Facility facility = Facility.create(stationId, 1L, facilityType, "출구", "Exit",
                new BigDecimal("10.0"), new BigDecimal("20.0"), null, true);
        ReflectionTestUtils.setField(facility, "id", id);
        return facility;
    }

    private PlaceExitRecommendation recommendation(long id, long placeId, long exitFacilityId, boolean primary) {
        PlaceExitRecommendation recommendation = PlaceExitRecommendation.create(
                placeId, exitFacilityId, 1, "가까운 출구", null, 6, primary);
        ReflectionTestUtils.setField(recommendation, "id", id);
        return recommendation;
    }
}
