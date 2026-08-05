package com.pingo.backend.localization.anchoring;

import com.pingo.backend.facility.domain.Facility;
import com.pingo.backend.facility.repository.FacilityRepository;
import com.pingo.backend.route.domain.RouteEdge;
import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.repository.RouteEdgeRepository;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.PriorityQueue;
import java.util.Set;

/**
 * 캐노니컬 좌표를 사용자에게 보여줄 위치와 경로 탐색 진입 노드로 정리한다(S15P11A206-128).
 *
 * <p><b>좌표는 노드에 붙이지 않는다.</b> 경로 노드는 경유점이라 간격이 넓고(역삼역 최근접 중앙값
 * B2 6.9m·B3 7.7m, 노드가 없는 구간은 10m 이상) 거기에 스냅하면 위치 표시가 실제와 크게 어긋난다.
 * 지도에는 변환한 좌표를 그대로 찍는다.
 *
 * <p>노드는 {@code POST /api/routes/indoor} 가 {@code startNodeId} 를 요구해서 필요하다.
 * 그래서 가장 가까운 노드 하나만 골라 경로 진입점으로 쓴다. 역삼역 노드 142개는 연결 요소가
 * 하나라 어느 노드에서 출발해도 경로가 나온다.
 *
 * <p>후보 풀은 그 층 노드 전부다. 복도 노드와 시설 노드를 가리지 않는다 — 경로 탐색이 이미 둘을
 * 한 그래프로 쓴다. 거리는 높이를 포함한 3차원이다. 역삼역 B1 은 개찰구 위 중간층(B0.5)이 같은 층
 * 안에 {@code map_z=7.5} 로 들어 있어 평면 거리만 쓰면 중간층 노드를 바닥으로 착각한다.
 */
@Component
@RequiredArgsConstructor
public class IndoorPositionResolver {

    private static final int SCALE = 3;

    /**
     * 방향 단위벡터 성분의 자리수. 좌표(mm)보다 촘촘하게 둔다.
     *
     * <p>두 성분을 따로 반올림하면 벡터 길이가 1 에서 벗어난다. 좌표와 같은 3자리면 오차가
     * 1e-3 까지 벌어지지만 6자리면 1e-6 수준이라, FE 가 정규화 없이 그대로 써도 무해하다.
     */
    private static final int DIRECTION_SCALE = 6;
    private static final double NEARBY_FACILITY_M = 10.0;
    private static final double TOWARD_FACILITY_M = 20.0;

    private final RouteNodeRepository routeNodeRepository;
    private final RouteEdgeRepository routeEdgeRepository;
    private final FacilityRepository facilityRepository;
    private final StationFloorRepository stationFloorRepository;

    /**
     * @param stationId 역 ID
     * @param floorCode AI 응답의 층 코드
     * @param point     변환된 캐노니컬 좌표
     * @param forward   변환된 캐노니컬 방향. 산출하지 못했으면 {@code null} 이며 좌표만 돌려준다
     * @param accuracyM 해당 층 위치 정확도(m). 정합의 leave-one-out 평균이다
     * @return 좌표와 경로 진입 노드. 층이나 노드를 찾지 못하면 비어 있다.
     */
    public Optional<AnchoredLocation> resolve(
            Long stationId,
            String floorCode,
            CanonicalPoint point,
            CanonicalDirection forward,
            double accuracyM
    ) {
        Optional<StationFloor> floor = stationFloorRepository.findByStationIdAndFloorCode(stationId, floorCode);
        if (floor.isEmpty()) {
            return Optional.empty();
        }

        Long floorId = floor.get().getId();
        List<RouteNode> floorNodes = routeNodeRepository.search(stationId, floorId);
        Optional<RouteNode> nearest = floorNodes.stream()
                .min(Comparator.comparingDouble(node -> distanceTo(node, point)));
        if (nearest.isEmpty()) {
            return Optional.empty();
        }

        RouteNode node = nearest.get();
        NodeLabels labels = labelsOf(stationId, floorId, floorCode, node, floorNodes);

        return Optional.of(new AnchoredLocation(
                floorId,
                floorCode,
                round(point.x()),
                round(point.y()),
                round(point.z()),
                forward == null ? null : roundDirection(forward.x()),
                forward == null ? null : roundDirection(forward.y()),
                round(accuracyM),
                node.getId(),
                labels.ko(),
                labels.en(),
                round(distanceTo(node, point))
        ));
    }

    /**
     * 노드까지의 3차원 거리(m).
     *
     * <p>높이가 없는 노드는 <b>질의 지점과 같은 높이로 본다.</b> 질의 높이가 그 층 바닥
     * ({@code nominalZ}) 이므로 "바닥에 있다고 가정"하는 것과 같고, 그 노드의 거리는 결과적으로
     * 평면 거리가 된다.
     *
     * <p><b>그래서 높이 없는 노드는 여전히 유리하다.</b> 같은 층 안에 높이가 다른 구간(역삼역
     * B0.5, {@code map_z=7.5})이 있을 때, 실제로는 그 위에 있는 노드인데 값이 비어 있으면
     * 바닥으로 취급돼 뽑힌다. 근본 해결은 값을 채우는 것이라 관리자 노드 등록·수정에
     * {@code mapZ} 를 열어 두었다. 역삼역 노드 142개는 모두 값이 있다.
     */
    private double distanceTo(RouteNode node, CanonicalPoint point) {
        double dx = node.getMapX().doubleValue() - point.x();
        double dy = node.getMapY().doubleValue() - point.y();
        double nodeZ = node.getMapZ() == null ? point.z() : node.getMapZ().doubleValue();
        double dz = nodeZ - point.z();
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /** 사용자에게 내부 코드 대신 층·랜드마크 관계가 드러나는 출발지를 돌려준다. */
    private NodeLabels labelsOf(
            Long stationId,
            Long floorId,
            String floorCode,
            RouteNode node,
            List<RouteNode> floorNodes
    ) {
        List<Facility> facilities = facilityRepository.searchActive(stationId, floorId, null);
        Optional<Facility> attached = facilities.stream()
                .filter(facility -> node.getId().equals(facility.getLinkedNodeId()))
                .findFirst();
        if (attached.isPresent()) {
            Facility facility = attached.orElseThrow();
            return withFloor(floorCode, facility.getNameKo(), englishNameOf(facility));
        }

        Optional<NearbyFacility> nearby = nearestFacility(
                node,
                floorNodes,
                facilities,
                routeEdgeRepository.findAllByStationIdAndActiveTrueOrderByIdAsc(stationId)
        );
        if (nearby.isPresent() && nearby.orElseThrow().distanceM() <= NEARBY_FACILITY_M) {
            Facility facility = nearby.orElseThrow().facility();
            return withFloor(
                    floorCode,
                    facility.getNameKo() + " 인근",
                    "Near " + englishNameOf(facility)
            );
        }
        if (nearby.isPresent() && nearby.orElseThrow().distanceM() <= TOWARD_FACILITY_M) {
            Facility facility = nearby.orElseThrow().facility();
            return withFloor(
                    floorCode,
                    facility.getNameKo() + " 방면 통로",
                    "Passage toward " + englishNameOf(facility)
            );
        }
        if ("B3".equalsIgnoreCase(floorCode)) {
            PlatformZone zone = platformZoneOf(node, floorNodes);
            return withFloor(floorCode, zone.ko(), zone.en());
        }
        return withFloor(floorCode, "통로", "Passage");
    }

    private Optional<NearbyFacility> nearestFacility(
            RouteNode start,
            List<RouteNode> floorNodes,
            List<Facility> facilities,
            List<RouteEdge> stationEdges
    ) {
        Set<Long> floorNodeIds = new HashSet<>();
        floorNodes.forEach(node -> floorNodeIds.add(node.getId()));

        Map<Long, List<Neighbor>> graph = new HashMap<>();
        for (RouteEdge edge : stationEdges) {
            if (!floorNodeIds.contains(edge.getFromNodeId()) || !floorNodeIds.contains(edge.getToNodeId())) {
                continue;
            }
            double distance = edge.getDistanceM().doubleValue();
            graph.computeIfAbsent(edge.getFromNodeId(), ignored -> new ArrayList<>())
                    .add(new Neighbor(edge.getToNodeId(), distance));
            // 위치 설명은 통행 방향이 아니라 공간적 인접성을 나타내므로 단방향 간선도 양쪽으로 잰다.
            graph.computeIfAbsent(edge.getToNodeId(), ignored -> new ArrayList<>())
                    .add(new Neighbor(edge.getFromNodeId(), distance));
        }

        Map<Long, Facility> facilityByNode = new HashMap<>();
        facilities.stream()
                .filter(facility -> facility.getLinkedNodeId() != null)
                .forEach(facility -> facilityByNode.putIfAbsent(facility.getLinkedNodeId(), facility));

        Map<Long, Double> distances = new HashMap<>();
        PriorityQueue<NodeDistance> queue = new PriorityQueue<>(Comparator.comparingDouble(NodeDistance::distanceM));
        distances.put(start.getId(), 0.0);
        queue.add(new NodeDistance(start.getId(), 0.0));

        while (!queue.isEmpty()) {
            NodeDistance current = queue.poll();
            if (current.distanceM() > distances.getOrDefault(current.nodeId(), Double.POSITIVE_INFINITY)) {
                continue;
            }
            Facility facility = facilityByNode.get(current.nodeId());
            if (facility != null) {
                return Optional.of(new NearbyFacility(facility, current.distanceM()));
            }
            for (Neighbor neighbor : graph.getOrDefault(current.nodeId(), List.of())) {
                double candidate = current.distanceM() + neighbor.distanceM();
                if (candidate < distances.getOrDefault(neighbor.nodeId(), Double.POSITIVE_INFINITY)) {
                    distances.put(neighbor.nodeId(), candidate);
                    queue.add(new NodeDistance(neighbor.nodeId(), candidate));
                }
            }
        }
        return Optional.empty();
    }

    private PlatformZone platformZoneOf(RouteNode node, List<RouteNode> floorNodes) {
        double minX = floorNodes.stream().mapToDouble(value -> value.getMapX().doubleValue()).min().orElse(0.0);
        double maxX = floorNodes.stream().mapToDouble(value -> value.getMapX().doubleValue()).max().orElse(0.0);
        double width = maxX - minX;
        if (width <= 0.0) {
            return new PlatformZone("승강장 구간", "Platform area");
        }
        double position = (node.getMapX().doubleValue() - minX) / width;
        if (position < 1.0 / 3.0) {
            return new PlatformZone("승강장 서쪽 구간", "West platform area");
        }
        if (position < 2.0 / 3.0) {
            return new PlatformZone("승강장 중앙 구간", "Central platform area");
        }
        return new PlatformZone("승강장 동쪽 구간", "East platform area");
    }

    private NodeLabels withFloor(String floorCode, String placeKo, String placeEn) {
        return new NodeLabels(floorCode + " · " + placeKo, floorCode + " · " + placeEn);
    }

    private String englishNameOf(Facility facility) {
        return facility.getNameEn() == null || facility.getNameEn().isBlank()
                ? facility.getNameKo()
                : facility.getNameEn();
    }

    private record Neighbor(Long nodeId, double distanceM) {
    }

    private record NodeDistance(Long nodeId, double distanceM) {
    }

    private record NearbyFacility(Facility facility, double distanceM) {
    }

    private record NodeLabels(String ko, String en) {
    }

    private record PlatformZone(String ko, String en) {
    }

    private BigDecimal round(double value) {
        return BigDecimal.valueOf(value).setScale(SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal roundDirection(double value) {
        return BigDecimal.valueOf(value).setScale(DIRECTION_SCALE, RoundingMode.HALF_UP);
    }
}
