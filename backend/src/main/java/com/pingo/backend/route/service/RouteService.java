package com.pingo.backend.route.service;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.route.domain.RouteEdge;
import com.pingo.backend.route.domain.RouteMoveType;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.domain.RouteNodeType;
import com.pingo.backend.route.dto.request.RouteEdgeCreateRequest;
import com.pingo.backend.route.dto.request.RouteEdgeUpdateRequest;
import com.pingo.backend.route.dto.request.RouteNodeCreateRequest;
import com.pingo.backend.route.dto.request.RouteNodeUpdateRequest;
import com.pingo.backend.route.dto.response.RouteEdgeIdResponse;
import com.pingo.backend.route.dto.response.RouteEdgeResponse;
import com.pingo.backend.route.dto.response.RouteNodeIdResponse;
import com.pingo.backend.route.dto.response.RouteNodeResponse;
import com.pingo.backend.route.repository.RouteEdgeRepository;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import com.pingo.backend.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RouteService {

    private final RouteNodeRepository routeNodeRepository;
    private final RouteEdgeRepository routeEdgeRepository;
    private final StationRepository stationRepository;
    private final StationFloorRepository stationFloorRepository;

    // ---------- Route Node ----------

    @Transactional
    public RouteNodeIdResponse createNode(RouteNodeCreateRequest request) {
        validateStationAndFloor(request.stationId(), request.floorId());
        String nodeType = validateNodeType(request.nodeType());

        RouteNode node = RouteNode.create(
                request.stationId(),
                request.floorId(),
                nodeType,
                trimToNull(request.name()),
                request.mapX(),
                request.mapY(),
                request.mapZ(),
                Boolean.TRUE.equals(request.isLandmark())
        );

        return new RouteNodeIdResponse(routeNodeRepository.save(node).getId());
    }

    public List<RouteNodeResponse> getNodes(Long stationId, Long floorId) {
        requireStationId(stationId);
        validateStationActive(stationId);

        return routeNodeRepository.search(stationId, floorId).stream()
                .map(RouteNodeResponse::from)
                .toList();
    }

    public RouteNodeResponse getNode(Long nodeId) {
        return RouteNodeResponse.from(getNodeEntity(nodeId));
    }

    @Transactional
    public RouteNodeResponse updateNode(Long nodeId, RouteNodeUpdateRequest request) {
        RouteNode node = getNodeEntity(nodeId);
        node.update(
                validateNodeType(request.nodeType()),
                trimToNull(request.name()),
                request.mapX(),
                request.mapY(),
                request.mapZ(),
                Boolean.TRUE.equals(request.isLandmark())
        );

        return RouteNodeResponse.from(node);
    }

    @Transactional
    public void deleteNode(Long nodeId) {
        RouteNode node = getNodeEntity(nodeId);

        try {
            routeNodeRepository.delete(node);
            routeNodeRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new BusinessException(ErrorCode.ROUTE_NODE_IN_USE);
        }
    }

    // ---------- Route Edge ----------

    @Transactional
    public RouteEdgeIdResponse createEdge(RouteEdgeCreateRequest request) {
        validateStationActive(request.stationId());
        validateEndpoints(request.stationId(), request.fromNodeId(), request.toNodeId());
        String moveType = validateMoveType(request.moveType());

        RouteEdge edge = RouteEdge.create(
                request.stationId(),
                request.fromNodeId(),
                request.toNodeId(),
                request.distanceM(),
                request.estimatedTimeSec(),
                moveType,
                Boolean.TRUE.equals(request.isAccessible()),
                request.isBidirectional() == null || request.isBidirectional()
        );

        return new RouteEdgeIdResponse(routeEdgeRepository.save(edge).getId());
    }

    public List<RouteEdgeResponse> getEdges(Long stationId) {
        requireStationId(stationId);
        validateStationActive(stationId);

        return routeEdgeRepository.findAllByStationIdAndActiveTrueOrderByIdAsc(stationId).stream()
                .map(RouteEdgeResponse::from)
                .toList();
    }

    public RouteEdgeResponse getEdge(Long edgeId) {
        return RouteEdgeResponse.from(getActiveEdge(edgeId));
    }

    @Transactional
    public RouteEdgeResponse updateEdge(Long edgeId, RouteEdgeUpdateRequest request) {
        RouteEdge edge = getActiveEdge(edgeId);
        edge.update(
                request.distanceM(),
                request.estimatedTimeSec(),
                validateMoveType(request.moveType()),
                Boolean.TRUE.equals(request.isAccessible()),
                request.isBidirectional() == null || request.isBidirectional()
        );

        return RouteEdgeResponse.from(edge);
    }

    @Transactional
    public void deleteEdge(Long edgeId) {
        getActiveEdge(edgeId).deactivate();
    }

    // ---------- helpers ----------

    private void validateEndpoints(Long stationId, Long fromNodeId, Long toNodeId) {
        if (fromNodeId.equals(toNodeId)) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
        requireNodeInStation(fromNodeId, stationId);
        requireNodeInStation(toNodeId, stationId);
    }

    private void requireNodeInStation(Long nodeId, Long stationId) {
        RouteNode node = getNodeEntity(nodeId);
        if (!node.getStationId().equals(stationId)) {
            throw new BusinessException(ErrorCode.ROUTE_NODE_NOT_FOUND);
        }
    }

    private void validateStationAndFloor(Long stationId, Long floorId) {
        validateStationActive(stationId);

        StationFloor floor = stationFloorRepository.findById(floorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.FLOOR_NOT_FOUND));
        if (!floor.getStation().getId().equals(stationId)) {
            throw new BusinessException(ErrorCode.FLOOR_NOT_FOUND);
        }
    }

    private void requireStationId(Long stationId) {
        if (stationId == null) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }
    }

    private void validateStationActive(Long stationId) {
        if (stationRepository.findByIdAndActiveTrue(stationId).isEmpty()) {
            throw new BusinessException(ErrorCode.STATION_NOT_FOUND);
        }
    }

    private RouteNode getNodeEntity(Long nodeId) {
        return routeNodeRepository.findById(nodeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROUTE_NODE_NOT_FOUND));
    }

    private RouteEdge getActiveEdge(Long edgeId) {
        return routeEdgeRepository.findByIdAndActiveTrue(edgeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ROUTE_EDGE_NOT_FOUND));
    }

    private String validateNodeType(String nodeType) {
        return RouteNodeType.fromCode(nodeType)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNSUPPORTED_NODE_TYPE))
                .getCode();
    }

    private String validateMoveType(String moveType) {
        return RouteMoveType.fromCode(moveType)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNSUPPORTED_MOVE_TYPE))
                .getCode();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
