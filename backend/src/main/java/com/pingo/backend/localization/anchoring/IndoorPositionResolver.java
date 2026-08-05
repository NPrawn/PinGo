package com.pingo.backend.localization.anchoring;

import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

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
    private final RouteNodeRepository routeNodeRepository;
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
        if (floorCode == null || floorCode.isBlank()) {
            return Optional.empty();
        }
        String normalizedFloorCode = floorCode.trim().toUpperCase(Locale.ROOT);
        Optional<StationFloor> floor = stationFloorRepository
                .findByStationIdAndFloorCode(stationId, normalizedFloorCode);
        if (floor.isEmpty()) {
            return Optional.empty();
        }

        StationFloor stationFloor = floor.orElseThrow();
        Long floorId = stationFloor.getId();
        List<RouteNode> floorNodes = routeNodeRepository.search(stationId, floorId);
        Optional<RouteNode> nearest = floorNodes.stream()
                .min(Comparator.comparingDouble(node -> distanceTo(node, point)));
        if (nearest.isEmpty()) {
            return Optional.empty();
        }

        RouteNode node = nearest.get();
        NodeLabels labels = labelsOf(normalizedFloorCode, stationFloor.getSpaceType());

        return Optional.of(new AnchoredLocation(
                floorId,
                normalizedFloorCode,
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

    /** 세부 노드명 대신 사용자가 구분하기 쉬운 층과 공간 유형만 표시한다. */
    private NodeLabels labelsOf(String floorCode, String spaceType) {
        return switch (spaceType == null ? "" : spaceType) {
            case "concourse" -> new NodeLabels(floorCode + " · 대합실", floorCode + " · Concourse");
            case "platform" -> new NodeLabels(floorCode + " · 승강장", floorCode + " · Platform");
            default -> new NodeLabels(floorCode + " · 역사 내부", floorCode + " · Station interior");
        };
    }

    private record NodeLabels(String ko, String en) {
    }

    private BigDecimal round(double value) {
        return BigDecimal.valueOf(value).setScale(SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal roundDirection(double value) {
        return BigDecimal.valueOf(value).setScale(DIRECTION_SCALE, RoundingMode.HALF_UP);
    }
}
