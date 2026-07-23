package com.pingo.backend.facility.service;

import com.pingo.backend.facility.domain.ExitDetail;
import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.dto.request.ExitDetailRequest;
import com.pingo.backend.facility.dto.request.FacilityCreateRequest;
import com.pingo.backend.facility.dto.request.FacilityUpdateRequest;
import com.pingo.backend.facility.dto.response.FacilityDetailResponse;
import com.pingo.backend.facility.dto.response.FacilityIdResponse;
import com.pingo.backend.facility.dto.response.FacilityResponse;
import com.pingo.backend.facility.repository.ExitDetailRepository;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FacilityServiceTest {

    @Mock
    private FacilityRepository facilityRepository;

    @Mock
    private ExitDetailRepository exitDetailRepository;

    @Mock
    private StationRepository stationRepository;

    @Mock
    private StationFloorRepository stationFloorRepository;

    private FacilityService facilityService;

    @BeforeEach
    void setUp() {
        facilityService = new FacilityService(
                facilityRepository, exitDetailRepository, stationRepository, stationFloorRepository);
    }

    @Test
    void createExitFacilityAlsoSavesExitDetail() {
        stubStationAndFloor(1L, 2L);
        when(facilityRepository.save(any(Facility.class))).thenAnswer(invocation -> {
            Facility facility = invocation.getArgument(0);
            ReflectionTestUtils.setField(facility, "id", 10L);
            return facility;
        });
        FacilityCreateRequest request = new FacilityCreateRequest(
                1L, 2L, " Exit ", "5번 출구", "Exit 5",
                new BigDecimal("820.4"), new BigDecimal("120.7"), null, true,
                new ExitDetailRequest("5", new BigDecimal("37.4982"), new BigDecimal("127.0281"), null, null));

        FacilityIdResponse response = facilityService.createFacility(request);

        assertThat(response.facilityId()).isEqualTo(10L);
        verify(exitDetailRepository).save(any(ExitDetail.class));
    }

    @Test
    void createNonExitFacilityDoesNotSaveExitDetail() {
        stubStationAndFloor(1L, 2L);
        when(facilityRepository.save(any(Facility.class))).thenAnswer(invocation -> {
            Facility facility = invocation.getArgument(0);
            ReflectionTestUtils.setField(facility, "id", 11L);
            return facility;
        });
        FacilityCreateRequest request = new FacilityCreateRequest(
                1L, 2L, "elevator", "엘리베이터", null,
                new BigDecimal("300"), new BigDecimal("200"), null, null, null);

        FacilityIdResponse response = facilityService.createFacility(request);

        assertThat(response.facilityId()).isEqualTo(11L);
        verify(exitDetailRepository, never()).save(any());
    }

    @Test
    void createFacilityThrowsForUnsupportedFacilityType() {
        stubStationAndFloor(1L, 2L);
        FacilityCreateRequest request = new FacilityCreateRequest(
                1L, 2L, "elavator", "엘리베이터", null,
                new BigDecimal("300"), new BigDecimal("200"), null, null, null);

        assertThatThrownBy(() -> facilityService.createFacility(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNSUPPORTED_FACILITY_TYPE));
        verify(facilityRepository, never()).save(any());
    }

    @Test
    void createFacilityThrowsWhenStationNotFound() {
        when(stationRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());
        FacilityCreateRequest request = new FacilityCreateRequest(
                99L, 2L, "exit", "출구", null,
                new BigDecimal("1"), new BigDecimal("1"), null, null, null);

        assertThatThrownBy(() -> facilityService.createFacility(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATION_NOT_FOUND));
        verify(facilityRepository, never()).save(any());
    }

    @Test
    void createFacilityThrowsWhenFloorDoesNotBelongToStation() {
        Station station = createStation(1L, true);
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station));
        StationFloor floorOfOtherStation = createFloor(2L, createStation(99L, true));
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(floorOfOtherStation));
        FacilityCreateRequest request = new FacilityCreateRequest(
                1L, 2L, "exit", "출구", null,
                new BigDecimal("1"), new BigDecimal("1"), null, null, null);

        assertThatThrownBy(() -> facilityService.createFacility(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FLOOR_NOT_FOUND));
    }

    @Test
    void getFacilityReturnsDetailWithExitDetailForExit() {
        Facility facility = createFacility(10L, "exit");
        when(facilityRepository.findByIdAndActiveTrue(10L)).thenReturn(Optional.of(facility));
        when(exitDetailRepository.findByFacilityId(10L)).thenReturn(Optional.of(
                ExitDetail.create(10L, "5", new BigDecimal("37.4982"), new BigDecimal("127.0281"), null, null)));

        FacilityDetailResponse response = facilityService.getFacility(10L);

        assertThat(response.facilityId()).isEqualTo(10L);
        assertThat(response.exitDetail()).isNotNull();
        assertThat(response.exitDetail().exitNumber()).isEqualTo("5");
    }

    @Test
    void getFacilitiesReturnsMappedList() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(createStation(1L, true)));
        when(facilityRepository.searchActive(1L, null, null)).thenReturn(List.of(createFacility(10L, "exit")));

        List<FacilityResponse> responses = facilityService.getFacilities(1L, null, null);

        assertThat(responses)
                .extracting(FacilityResponse::facilityId, FacilityResponse::facilityType)
                .containsExactly(org.assertj.core.api.Assertions.tuple(10L, "exit"));
    }

    @Test
    void updateFacilityToNonExitDeletesExitDetail() {
        Facility facility = createFacility(10L, "exit");
        when(facilityRepository.findByIdAndActiveTrue(10L)).thenReturn(Optional.of(facility));
        FacilityUpdateRequest request = new FacilityUpdateRequest(
                "elevator", "엘리베이터", null,
                new BigDecimal("300"), new BigDecimal("200"), null, true, null);

        FacilityDetailResponse response = facilityService.updateFacility(10L, request);

        assertThat(response.facilityType()).isEqualTo("elevator");
        assertThat(response.exitDetail()).isNull();
        verify(exitDetailRepository).deleteByFacilityId(10L);
    }

    @Test
    void deleteFacilityDeactivatesFacility() {
        Facility facility = createFacility(10L, "exit");
        when(facilityRepository.findByIdAndActiveTrue(10L)).thenReturn(Optional.of(facility));

        facilityService.deleteFacility(10L);

        assertThat(facility.isActive()).isFalse();
    }

    @Test
    void getFacilityThrowsWhenNotFound() {
        when(facilityRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> facilityService.getFacility(99L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FACILITY_NOT_FOUND));
    }

    private void stubStationAndFloor(Long stationId, Long floorId) {
        Station station = createStation(stationId, true);
        when(stationRepository.findByIdAndActiveTrue(stationId)).thenReturn(Optional.of(station));
        when(stationFloorRepository.findById(floorId)).thenReturn(Optional.of(createFloor(floorId, station)));
    }

    private Station createStation(Long id, boolean active) {
        Station station = Station.create(
                "역삼역", "Yeoksam Station", "2호선",
                new BigDecimal("37.5007000"), new BigDecimal("127.0365000"));
        if (!active) {
            station.deactivate();
        }
        ReflectionTestUtils.setField(station, "id", id);
        return station;
    }

    private StationFloor createFloor(Long floorId, Station station) {
        StationFloor floor = StationFloor.create(station, "B2", "지하 2층", 1);
        ReflectionTestUtils.setField(floor, "id", floorId);
        return floor;
    }

    private Facility createFacility(Long id, String facilityType) {
        Facility facility = Facility.create(
                1L, 2L, facilityType, "5번 출구", "Exit 5",
                new BigDecimal("820.4"), new BigDecimal("120.7"), null, true);
        ReflectionTestUtils.setField(facility, "id", id);
        return facility;
    }
}
