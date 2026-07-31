package com.pingo.backend.floormap.service;

import com.pingo.backend.floormap.domain.FloorMap;
import com.pingo.backend.floormap.dto.request.FloorMapUploadRequest;
import com.pingo.backend.floormap.dto.response.FloorMapIdResponse;
import com.pingo.backend.floormap.dto.response.FloorMapResponse;
import com.pingo.backend.floormap.repository.FloorMapRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import com.pingo.backend.station.repository.StationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FloorMapServiceTest {

    @Mock
    private FloorMapRepository floorMapRepository;

    @Mock
    private StationFloorRepository stationFloorRepository;

    @Mock
    private StationRepository stationRepository;

    @Mock
    private FileStorageService fileStorageService;

    private FloorMapService floorMapService;

    @BeforeEach
    void setUp() {
        floorMapService = new FloorMapService(
                floorMapRepository, stationFloorRepository, stationRepository, fileStorageService);
    }

    @Test
    void uploadMapDeactivatesPreviousAndSavesNewActiveMap() {
        StationFloor floor = createFloor(2L, true);
        FloorMap existing = createFloorMap(10L, 2L);
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(floor));
        when(fileStorageService.store(any(MultipartFile.class), eq("maps"))).thenReturn("/uploads/maps/new.png");
        when(floorMapRepository.findAllByFloorIdAndActiveTrueOrderByCreatedAtDesc(2L)).thenReturn(List.of(existing));
        when(floorMapRepository.countByFloorId(2L)).thenReturn(1L);
        when(floorMapRepository.save(any(FloorMap.class))).thenAnswer(invocation -> {
            FloorMap saved = invocation.getArgument(0);
            ReflectionTestUtils.setField(saved, "id", 11L);
            return saved;
        });
        FloorMapUploadRequest request = new FloorMapUploadRequest(
                " Image ", 1200, 800, new BigDecimal("0.05"),
                new BigDecimal("622.000"), new BigDecimal("512.000"), new BigDecimal("-21.2800"));

        FloorMapIdResponse response = floorMapService.uploadMap(2L, request, mapFile());

        assertThat(response.mapId()).isEqualTo(11L);
        assertThat(existing.isActive()).isFalse();
    }

    @Test
    void uploadMapStoresCoordinateFrame() {
        StationFloor floor = createFloor(2L, true);
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(floor));
        when(fileStorageService.store(any(MultipartFile.class), eq("maps"))).thenReturn("/uploads/maps/new.png");
        when(floorMapRepository.findAllByFloorIdAndActiveTrueOrderByCreatedAtDesc(2L)).thenReturn(List.of());
        when(floorMapRepository.countByFloorId(2L)).thenReturn(0L);
        when(floorMapRepository.save(any(FloorMap.class))).thenAnswer(invocation -> invocation.getArgument(0));
        FloorMapUploadRequest request = new FloorMapUploadRequest(
                "image", 1624, 969, new BigDecimal("0.190000"),
                new BigDecimal("622.000"), new BigDecimal("512.000"), new BigDecimal("-21.2800"));

        floorMapService.uploadMap(2L, request, mapFile());

        ArgumentCaptor<FloorMap> captor = ArgumentCaptor.forClass(FloorMap.class);
        verify(floorMapRepository).save(captor.capture());
        FloorMap saved = captor.getValue();
        assertThat(saved.getOriginPxX()).isEqualByComparingTo("622.000");
        assertThat(saved.getOriginPxY()).isEqualByComparingTo("512.000");
        assertThat(saved.getFrameAngleDeg()).isEqualByComparingTo("-21.2800");
        assertThat(saved.hasCoordinateFrame()).isTrue();
    }

    @Test
    void uploadMapWithoutCoordinateFrameIsAllowedButCannotOverlay() {
        StationFloor floor = createFloor(2L, true);
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(floor));
        when(fileStorageService.store(any(MultipartFile.class), eq("maps"))).thenReturn("/uploads/maps/new.png");
        when(floorMapRepository.findAllByFloorIdAndActiveTrueOrderByCreatedAtDesc(2L)).thenReturn(List.of());
        when(floorMapRepository.countByFloorId(2L)).thenReturn(0L);
        when(floorMapRepository.save(any(FloorMap.class))).thenAnswer(invocation -> invocation.getArgument(0));
        // 축척만 있고 원점·회전각이 없다. 프레임은 네 값이 다 있어야 성립한다.
        FloorMapUploadRequest request = new FloorMapUploadRequest(
                "image", 1624, 969, new BigDecimal("0.190000"), null, null, null);

        floorMapService.uploadMap(2L, request, mapFile());

        ArgumentCaptor<FloorMap> captor = ArgumentCaptor.forClass(FloorMap.class);
        verify(floorMapRepository).save(captor.capture());
        assertThat(captor.getValue().hasCoordinateFrame()).isFalse();
    }

    @Test
    void uploadMapThrowsWhenFloorDoesNotExist() {
        when(stationFloorRepository.findById(99L)).thenReturn(Optional.empty());
        FloorMapUploadRequest request = new FloorMapUploadRequest("image", null, null, null, null, null, null);

        assertThatThrownBy(() -> floorMapService.uploadMap(99L, request, mapFile()))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FLOOR_NOT_FOUND));
        verify(fileStorageService, never()).store(any(), any());
    }

    @Test
    void uploadMapThrowsWhenStationIsInactive() {
        StationFloor floor = createFloor(2L, false);
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(floor));
        FloorMapUploadRequest request = new FloorMapUploadRequest("image", null, null, null, null, null, null);

        assertThatThrownBy(() -> floorMapService.uploadMap(2L, request, mapFile()))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FLOOR_NOT_FOUND));
        verify(fileStorageService, never()).store(any(), any());
    }

    @Test
    void uploadMapThrowsForUnsupportedMapType() {
        StationFloor floor = createFloor(2L, true);
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(floor));
        FloorMapUploadRequest request = new FloorMapUploadRequest("pdf", null, null, null, null, null, null);

        assertThatThrownBy(() -> floorMapService.uploadMap(2L, request, mapFile()))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNSUPPORTED_MAP_TYPE));
        verify(fileStorageService, never()).store(any(), any());
    }

    @Test
    void getMapsReturnsActiveMaps() {
        StationFloor floor = createFloor(2L, true);
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(floor));
        when(floorMapRepository.findAllByFloorIdAndActiveTrueOrderByCreatedAtDesc(2L))
                .thenReturn(List.of(createFloorMap(10L, 2L)));

        List<FloorMapResponse> responses = floorMapService.getMaps(2L);

        assertThat(responses)
                .extracting(FloorMapResponse::mapId, FloorMapResponse::floorCode, FloorMapResponse::mapUrl)
                .containsExactly(org.assertj.core.api.Assertions.tuple(10L, "B2", "/uploads/maps/old.png"));
    }

    @Test
    void getMapsByStationReturnsActiveMapsInFloorOrder() {
        Station station = createStationEntity(1L, true);
        StationFloor basementTwo = createFloorOf(2L, station, "B2", 1);
        StationFloor basementOne = createFloorOf(3L, station, "B1", 2);
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station));
        when(stationFloorRepository.findAllByStationIdOrderByFloorOrderAsc(1L))
                .thenReturn(List.of(basementTwo, basementOne));
        when(floorMapRepository.findAllByFloorIdInAndActiveTrue(any()))
                .thenReturn(List.of(createFloorMap(11L, 3L), createFloorMap(10L, 2L)));

        List<FloorMapResponse> responses = floorMapService.getMapsByStation(1L);

        assertThat(responses)
                .extracting(FloorMapResponse::mapId, FloorMapResponse::floorCode)
                .containsExactly(
                        org.assertj.core.api.Assertions.tuple(10L, "B2"),
                        org.assertj.core.api.Assertions.tuple(11L, "B1"));
    }

    @Test
    void getMapsByStationSkipsFloorsWithoutActiveMap() {
        Station station = createStationEntity(1L, true);
        StationFloor basementTwo = createFloorOf(2L, station, "B2", 1);
        StationFloor basementOne = createFloorOf(3L, station, "B1", 2);
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(station));
        when(stationFloorRepository.findAllByStationIdOrderByFloorOrderAsc(1L))
                .thenReturn(List.of(basementTwo, basementOne));
        when(floorMapRepository.findAllByFloorIdInAndActiveTrue(any()))
                .thenReturn(List.of(createFloorMap(10L, 2L)));

        List<FloorMapResponse> responses = floorMapService.getMapsByStation(1L);

        assertThat(responses)
                .extracting(FloorMapResponse::floorCode)
                .containsExactly("B2");
    }

    @Test
    void getMapsByStationThrowsWhenStationNotFound() {
        when(stationRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> floorMapService.getMapsByStation(99L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.STATION_NOT_FOUND));
    }

    private MultipartFile mapFile() {
        return new MockMultipartFile("mapFile", "b1.png", "image/png", "data".getBytes());
    }

    private StationFloor createFloor(Long floorId, boolean stationActive) {
        Station station = Station.create(
                "역삼역", "Yeoksam Station", "2호선",
                new BigDecimal("37.5007000"), new BigDecimal("127.0365000"));
        if (!stationActive) {
            station.deactivate();
        }
        ReflectionTestUtils.setField(station, "id", 1L);

        StationFloor floor = StationFloor.create(station, "B2", "지하 2층", 1);
        ReflectionTestUtils.setField(floor, "id", floorId);
        return floor;
    }

    private FloorMap createFloorMap(Long mapId, Long floorId) {
        FloorMap floorMap = FloorMap.create(
                floorId, "image", "/uploads/maps/old.png", 1200, 800, null, null, null, null, "v1");
        ReflectionTestUtils.setField(floorMap, "id", mapId);
        return floorMap;
    }

    private Station createStationEntity(Long id, boolean active) {
        Station station = Station.create(
                "역삼역", "Yeoksam Station", "2호선",
                new BigDecimal("37.5007000"), new BigDecimal("127.0365000"));
        if (!active) {
            station.deactivate();
        }
        ReflectionTestUtils.setField(station, "id", id);
        return station;
    }

    private StationFloor createFloorOf(Long floorId, Station station, String floorCode, int floorOrder) {
        StationFloor floor = StationFloor.create(station, floorCode, floorCode, floorOrder);
        ReflectionTestUtils.setField(floor, "id", floorId);
        return floor;
    }
}
