package com.pingo.backend.station.service;

import com.pingo.backend.externalmap.client.KakaoLocalClient;
import com.pingo.backend.externalmap.client.KakaoPlaceSearchResult;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.dto.request.FloorCreateRequest;
import com.pingo.backend.station.dto.request.FloorUpdateRequest;
import com.pingo.backend.station.dto.request.StationCreateRequest;
import com.pingo.backend.station.dto.response.FloorIdResponse;
import com.pingo.backend.station.dto.response.FloorResponse;
import com.pingo.backend.station.dto.response.StationDetailResponse;
import com.pingo.backend.station.dto.response.StationIdResponse;
import com.pingo.backend.station.dto.response.StationNearbyResponse;
import com.pingo.backend.station.dto.response.StationSearchResponse;
import com.pingo.backend.station.repository.StationFloorRepository;
import com.pingo.backend.station.repository.StationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StationServiceTest {

    @Mock
    private StationRepository stationRepository;

    @Mock
    private StationFloorRepository stationFloorRepository;

    @Mock
    private KakaoLocalClient kakaoLocalClient;

    private StationService stationService;

    @BeforeEach
    void setUp() {
        stationService = new StationService(stationRepository, stationFloorRepository, kakaoLocalClient);
    }

    @Test
    void createStationReturnsSavedStationId() {
        StationCreateRequest request = new StationCreateRequest(
                " 역삼역 ",
                " Yeoksam Station ",
                " 2호선 ",
                new BigDecimal("37.5007000"),
                new BigDecimal("127.0365000")
        );
        when(stationRepository.save(any(Station.class))).thenAnswer(invocation -> {
            Station station = invocation.getArgument(0);
            ReflectionTestUtils.setField(station, "id", 1L);
            return station;
        });

        StationIdResponse response = stationService.createStation(request);

        assertThat(response.stationId()).isEqualTo(1L);
    }

    @Test
    void searchStationsTrimsKeywordAndMapsResults() {
        Station station = createStation(1L);
        when(stationRepository.searchActiveByKeyword("역삼")).thenReturn(List.of(station));
        when(kakaoLocalClient.searchSubwayStations("역삼")).thenReturn(List.of());

        List<StationSearchResponse> responses = stationService.searchStations("  역삼  ");

        assertThat(responses)
                .extracting(StationSearchResponse::stationId, StationSearchResponse::nameKo)
                .containsExactly(tuple(1L, "역삼역"));
    }

    @Test
    void searchStationsAppendsExternalStationsAsNotServiceReady() {
        when(stationRepository.searchActiveByKeyword("선릉")).thenReturn(List.of());
        when(kakaoLocalClient.searchSubwayStations("선릉")).thenReturn(List.of(
                createKakaoStation("1", "선릉역 2호선"),
                createKakaoStation("2", "선릉역 수인분당선")
        ));

        List<StationSearchResponse> responses = stationService.searchStations("선릉");

        assertThat(responses).singleElement().satisfies(response -> {
            assertThat(response.stationId()).isNull();
            assertThat(response.nameKo()).isEqualTo("선릉역");
            assertThat(response.lineInfo()).isEqualTo("2호선·수인분당선");
            assertThat(response.provider()).isEqualTo("kakao");
            assertThat(response.serviceReady()).isFalse();
        });
    }

    @Test
    void searchStationsDropsExternalStationsWhoseNameDoesNotContainKeyword() {
        when(stationRepository.searchActiveByKeyword("사당")).thenReturn(List.of());
        when(kakaoLocalClient.searchSubwayStations("사당")).thenReturn(List.of(
                createKakaoStation("1", "사당역 2호선"),
                // 카카오는 검색어를 지역으로도 읽어 이름이 다른 주변 역까지 끼워 준다.
                createKakaoStation("2", "이수역 7호선"),
                createKakaoStation("3", "남성역 7호선")
        ));

        List<StationSearchResponse> responses = stationService.searchStations("사당");

        assertThat(responses)
                .extracting(StationSearchResponse::nameKo)
                .containsExactly("사당역");
    }

    @Test
    void searchStationsKeepsWholeNameWhenExternalResultHasNoLineSuffix() {
        when(stationRepository.searchActiveByKeyword("선릉")).thenReturn(List.of());
        when(kakaoLocalClient.searchSubwayStations("선릉")).thenReturn(List.of(
                createKakaoStation("1", "선릉역")
        ));

        List<StationSearchResponse> responses = stationService.searchStations("선릉");

        assertThat(responses).singleElement().satisfies(response -> {
            assertThat(response.nameKo()).isEqualTo("선릉역");
            assertThat(response.lineInfo()).isNull();
        });
    }

    @Test
    void searchStationsKeepsRegisteredStationWhenExternalResultHasSameName() {
        Station station = createStation(1L);
        when(stationRepository.searchActiveByKeyword("역삼")).thenReturn(List.of(station));
        when(kakaoLocalClient.searchSubwayStations("역삼")).thenReturn(List.of(
                createKakaoStation("1", "역삼역 2호선")
        ));

        List<StationSearchResponse> responses = stationService.searchStations("역삼");

        assertThat(responses)
                .extracting(StationSearchResponse::nameKo, StationSearchResponse::serviceReady)
                .containsExactly(tuple("역삼역", true));
    }

    @Test
    void searchStationsReturnsRegisteredStationsWhenExternalSearchFails() {
        Station station = createStation(1L);
        when(stationRepository.searchActiveByKeyword("역삼")).thenReturn(List.of(station));
        when(kakaoLocalClient.searchSubwayStations("역삼"))
                .thenThrow(new BusinessException(ErrorCode.EXTERNAL_PLACE_SEARCH_FAILED));

        List<StationSearchResponse> responses = stationService.searchStations("역삼");

        assertThat(responses)
                .extracting(StationSearchResponse::nameKo)
                .containsExactly("역삼역");
    }

    @Test
    void searchStationsSkipsExternalSearchWhenKeywordIsBlank() {
        when(stationRepository.findAllByActiveTrueOrderByNameKoAsc()).thenReturn(List.of(createStation(1L)));

        stationService.searchStations("  ");

        verify(kakaoLocalClient, never()).searchSubwayStations(any());
    }

    @Test
    void searchStationsReturnsAllActiveStationsWhenKeywordIsBlank() {
        Station station = createStation(1L);
        when(stationRepository.findAllByActiveTrueOrderByNameKoAsc()).thenReturn(List.of(station));

        List<StationSearchResponse> responses = stationService.searchStations("   ");

        assertThat(responses)
                .extracting(StationSearchResponse::stationId, StationSearchResponse::nameKo)
                .containsExactly(tuple(1L, "역삼역"));
        verify(stationRepository, never()).searchActiveByKeyword(any());
    }

    @Test
    void searchStationsReturnsAllActiveStationsWhenKeywordIsNull() {
        Station station = createStation(1L);
        when(stationRepository.findAllByActiveTrueOrderByNameKoAsc()).thenReturn(List.of(station));

        List<StationSearchResponse> responses = stationService.searchStations(null);

        assertThat(responses).hasSize(1);
        verify(stationRepository, never()).searchActiveByKeyword(any());
    }

    @Test
    void getStationReturnsFloorsInRepositoryOrder() {
        Station station = createStation(1L);
        StationFloor basementTwo = createFloor(2L, station, "B2", 1);
        StationFloor basementOne = createFloor(1L, station, "B1", 2);
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station));
        when(stationFloorRepository.findAllByStationIdOrderByFloorOrderAsc(1L))
                .thenReturn(List.of(basementTwo, basementOne));

        StationDetailResponse response = stationService.getStation(1L);

        assertThat(response.stationId()).isEqualTo(1L);
        assertThat(response.floors())
                .extracting(FloorResponse::floorCode)
                .containsExactly("B2", "B1");
    }

    @Test
    void getStationThrowsWhenStationDoesNotExist() {
        when(stationRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> stationService.getStation(99L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATION_NOT_FOUND));
    }

    @Test
    void deleteStationDeactivatesStation() {
        Station station = createStation(1L);
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station));

        stationService.deleteStation(1L);

        assertThat(station.isActive()).isFalse();
    }

    @Test
    void createFloorNormalizesCodeAndReturnsSavedFloorId() {
        Station station = createStation(1L);
        FloorCreateRequest request = new FloorCreateRequest(" b2 ", " 지하 2층 ", 1, null);
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station));
        when(stationFloorRepository.existsByStationIdAndFloorCode(1L, "B2")).thenReturn(false);
        when(stationFloorRepository.saveAndFlush(any(StationFloor.class))).thenAnswer(invocation -> {
            StationFloor floor = invocation.getArgument(0);
            ReflectionTestUtils.setField(floor, "id", 2L);
            return floor;
        });

        FloorIdResponse response = stationService.createFloor(1L, request);

        assertThat(response.floorId()).isEqualTo(2L);
    }

    @Test
    void createFloorThrowsWhenFloorCodeIsDuplicated() {
        Station station = createStation(1L);
        FloorCreateRequest request = new FloorCreateRequest("B2", "지하 2층", 1, null);
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station));
        when(stationFloorRepository.existsByStationIdAndFloorCode(1L, "B2")).thenReturn(true);

        assertThatThrownBy(() -> stationService.createFloor(1L, request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DUPLICATE_FLOOR_CODE));
        verify(stationFloorRepository, never()).saveAndFlush(any(StationFloor.class));
    }

    @Test
    void updateFloorThrowsWhenAnotherFloorUsesSameCode() {
        Station station = createStation(1L);
        StationFloor floor = createFloor(2L, station, "B2", 1);
        FloorUpdateRequest request = new FloorUpdateRequest("B1", "지하 1층", 2, null);
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(floor));
        when(stationFloorRepository.existsByStationIdAndFloorCodeAndIdNot(1L, "B1", 2L))
                .thenReturn(true);

        assertThatThrownBy(() -> stationService.updateFloor(2L, request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.DUPLICATE_FLOOR_CODE));
    }

    @Test
    void deleteFloorThrowsWhenFloorIsReferenced() {
        Station station = createStation(1L);
        StationFloor floor = createFloor(2L, station, "B2", 1);
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(floor));
        doThrow(new DataIntegrityViolationException("foreign key violation"))
                .when(stationFloorRepository).flush();

        assertThatThrownBy(() -> stationService.deleteFloor(2L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FLOOR_IN_USE));
    }

    @Test
    void getNearbyStationsReturnsStationsSortedByDistance() {
        Station near = createStationAt(1L, "역삼역", "37.5001000", "127.0001000");
        Station far = createStationAt(2L, "강남역", "37.6000000", "127.2000000");
        when(stationRepository.findAllByActiveTrueAndLatitudeIsNotNullAndLongitudeIsNotNull())
                .thenReturn(List.of(far, near));

        List<StationNearbyResponse> responses = stationService.getNearbyStations(37.5000, 127.0000);

        assertThat(responses)
                .extracting(StationNearbyResponse::stationId)
                .containsExactly(1L, 2L);
        assertThat(responses.get(0).distanceM()).isLessThan(responses.get(1).distanceM());
    }

    @Test
    void getNearbyStationsThrowsWhenCoordinatesAreNull() {
        assertThatThrownBy(() -> stationService.getNearbyStations(null, 127.0))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
        verify(stationRepository, never()).findAllByActiveTrueAndLatitudeIsNotNullAndLongitudeIsNotNull();
    }

    private Station createStation(Long id) {
        Station station = Station.create(
                "역삼역",
                "Yeoksam Station",
                "2호선",
                new BigDecimal("37.5007000"),
                new BigDecimal("127.0365000")
        );
        ReflectionTestUtils.setField(station, "id", id);
        return station;
    }

    private KakaoPlaceSearchResult createKakaoStation(String placeId, String placeName) {
        return new KakaoPlaceSearchResult(
                placeId,
                placeName,
                "교통,수송 > 지하철,전철",
                "서울 강남구 테헤란로 340",
                new BigDecimal("37.5045000"),
                new BigDecimal("127.0489000"),
                null
        );
    }

    private Station createStationAt(Long id, String nameKo, String latitude, String longitude) {
        Station station = Station.create(
                nameKo, nameKo, "2호선",
                new BigDecimal(latitude), new BigDecimal(longitude)
        );
        ReflectionTestUtils.setField(station, "id", id);
        return station;
    }

    private StationFloor createFloor(Long id, Station station, String floorCode, int floorOrder) {
        StationFloor floor = StationFloor.create(station, floorCode, floorCode, floorOrder, null);
        ReflectionTestUtils.setField(floor, "id", id);
        return floor;
    }
}
