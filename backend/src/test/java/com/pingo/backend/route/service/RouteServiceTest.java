package com.pingo.backend.route.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.route.domain.RouteEdge;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.dto.request.RouteEdgeCreateRequest;
import com.pingo.backend.route.dto.request.RouteNodeCreateRequest;
import com.pingo.backend.route.dto.response.RouteEdgeIdResponse;
import com.pingo.backend.route.dto.response.RouteNodeIdResponse;
import com.pingo.backend.route.repository.RouteEdgeRepository;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.domain.StationFloor;
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
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RouteServiceTest {

    @Mock
    private RouteNodeRepository routeNodeRepository;

    @Mock
    private RouteEdgeRepository routeEdgeRepository;

    @Mock
    private StationRepository stationRepository;

    @Mock
    private StationFloorRepository stationFloorRepository;

    private RouteService routeService;

    @BeforeEach
    void setUp() {
        routeService = new RouteService(
                routeNodeRepository, routeEdgeRepository, stationRepository, stationFloorRepository);
    }

    // ---------- node ----------

    @Test
    void createNodeReturnsSavedNodeId() {
        stubStationAndFloor(1L, 2L);
        when(routeNodeRepository.save(any(RouteNode.class))).thenAnswer(invocation -> {
            RouteNode node = invocation.getArgument(0);
            ReflectionTestUtils.setField(node, "id", 20L);
            return node;
        });
        RouteNodeCreateRequest request = new RouteNodeCreateRequest(
                1L, 2L, "junction", "B2 갈림길", new BigDecimal("300"), new BigDecimal("200"), true);

        RouteNodeIdResponse response = routeService.createNode(request);

        assertThat(response.nodeId()).isEqualTo(20L);
    }

    @Test
    void getNodesThrowsWhenStationIdIsNull() {
        assertThatThrownBy(() -> routeService.getNodes(null, null))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
    }

    @Test
    void createNodeThrowsForUnsupportedNodeType() {
        stubStationAndFloor(1L, 2L);
        RouteNodeCreateRequest request = new RouteNodeCreateRequest(
                1L, 2L, "weird", null, new BigDecimal("1"), new BigDecimal("1"), null);

        assertThatThrownBy(() -> routeService.createNode(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNSUPPORTED_NODE_TYPE));
        verify(routeNodeRepository, never()).save(any());
    }

    @Test
    void createNodeThrowsWhenFloorDoesNotBelongToStation() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(createStation(1L)));
        when(stationFloorRepository.findById(2L)).thenReturn(Optional.of(createFloor(2L, createStation(99L))));
        RouteNodeCreateRequest request = new RouteNodeCreateRequest(
                1L, 2L, "normal", null, new BigDecimal("1"), new BigDecimal("1"), null);

        assertThatThrownBy(() -> routeService.createNode(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.FLOOR_NOT_FOUND));
    }

    @Test
    void deleteNodeThrowsWhenNodeIsReferenced() {
        when(routeNodeRepository.findById(20L)).thenReturn(Optional.of(createNode(20L, 1L)));
        doThrow(new DataIntegrityViolationException("fk")).when(routeNodeRepository).flush();

        assertThatThrownBy(() -> routeService.deleteNode(20L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ROUTE_NODE_IN_USE));
    }

    // ---------- edge ----------

    @Test
    void createEdgeReturnsSavedEdgeId() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(createStation(1L)));
        when(routeNodeRepository.findById(20L)).thenReturn(Optional.of(createNode(20L, 1L)));
        when(routeNodeRepository.findById(21L)).thenReturn(Optional.of(createNode(21L, 1L)));
        when(routeEdgeRepository.save(any(RouteEdge.class))).thenAnswer(invocation -> {
            RouteEdge edge = invocation.getArgument(0);
            ReflectionTestUtils.setField(edge, "id", 30L);
            return edge;
        });
        RouteEdgeCreateRequest request = new RouteEdgeCreateRequest(
                1L, 20L, 21L, new BigDecimal("20"), 30, "walkway", true, true);

        RouteEdgeIdResponse response = routeService.createEdge(request);

        assertThat(response.edgeId()).isEqualTo(30L);
    }

    @Test
    void createEdgeThrowsForUnsupportedMoveType() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(createStation(1L)));
        when(routeNodeRepository.findById(20L)).thenReturn(Optional.of(createNode(20L, 1L)));
        when(routeNodeRepository.findById(21L)).thenReturn(Optional.of(createNode(21L, 1L)));
        RouteEdgeCreateRequest request = new RouteEdgeCreateRequest(
                1L, 20L, 21L, new BigDecimal("20"), null, "fly", null, null);

        assertThatThrownBy(() -> routeService.createEdge(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.UNSUPPORTED_MOVE_TYPE));
        verify(routeEdgeRepository, never()).save(any());
    }

    @Test
    void createEdgeThrowsWhenEndpointNotInStation() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(createStation(1L)));
        when(routeNodeRepository.findById(20L)).thenReturn(Optional.of(createNode(20L, 1L)));
        when(routeNodeRepository.findById(21L)).thenReturn(Optional.of(createNode(21L, 99L)));
        RouteEdgeCreateRequest request = new RouteEdgeCreateRequest(
                1L, 20L, 21L, new BigDecimal("20"), null, "walkway", null, null);

        assertThatThrownBy(() -> routeService.createEdge(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ROUTE_NODE_NOT_FOUND));
    }

    @Test
    void createEdgeThrowsForSelfLoop() {
        when(stationRepository.findByIdAndActiveTrue(1L)).thenReturn(Optional.of(createStation(1L)));
        RouteEdgeCreateRequest request = new RouteEdgeCreateRequest(
                1L, 20L, 20L, new BigDecimal("20"), null, "walkway", null, null);

        assertThatThrownBy(() -> routeService.createEdge(request))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.INVALID_REQUEST));
    }

    @Test
    void deleteEdgeDeactivatesEdge() {
        RouteEdge edge = createEdge(30L);
        when(routeEdgeRepository.findByIdAndActiveTrue(30L)).thenReturn(Optional.of(edge));

        routeService.deleteEdge(30L);

        assertThat(edge.isActive()).isFalse();
    }

    @Test
    void getEdgeThrowsWhenNotFound() {
        when(routeEdgeRepository.findByIdAndActiveTrue(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> routeService.getEdge(99L))
                .isInstanceOfSatisfying(BusinessException.class, exception ->
                        assertThat(exception.getErrorCode()).isEqualTo(ErrorCode.ROUTE_EDGE_NOT_FOUND));
    }

    // ---------- helpers ----------

    private void stubStationAndFloor(Long stationId, Long floorId) {
        Station station = createStation(stationId);
        when(stationRepository.findByIdAndActiveTrue(stationId)).thenReturn(Optional.of(station));
        when(stationFloorRepository.findById(floorId)).thenReturn(Optional.of(createFloor(floorId, station)));
    }

    private Station createStation(Long id) {
        Station station = Station.create(
                "역삼역", "Yeoksam Station", "2호선",
                new BigDecimal("37.5007000"), new BigDecimal("127.0365000"));
        ReflectionTestUtils.setField(station, "id", id);
        return station;
    }

    private StationFloor createFloor(Long floorId, Station station) {
        StationFloor floor = StationFloor.create(station, "B2", "지하 2층", 1);
        ReflectionTestUtils.setField(floor, "id", floorId);
        return floor;
    }

    private RouteNode createNode(Long id, Long stationId) {
        RouteNode node = RouteNode.create(
                stationId, 2L, "junction", "노드", new BigDecimal("300"), new BigDecimal("200"), false);
        ReflectionTestUtils.setField(node, "id", id);
        return node;
    }

    private RouteEdge createEdge(Long id) {
        RouteEdge edge = RouteEdge.create(
                1L, 20L, 21L, new BigDecimal("20"), 30, "walkway", true, true);
        ReflectionTestUtils.setField(edge, "id", id);
        return edge;
    }
}
