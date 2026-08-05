package com.pingo.backend.localization.anchoring;

import com.pingo.backend.route.domain.RouteNode;
import com.pingo.backend.route.repository.RouteNodeRepository;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.domain.StationFloor;
import com.pingo.backend.station.repository.StationFloorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class IndoorPositionResolverTest {

    private static final Long STATION = 1L;
    private static final Long B2_ID = 2L;
    private static final Long B3_ID = 3L;

    @Mock
    private RouteNodeRepository routeNodeRepository;
    @Mock
    private StationFloorRepository stationFloorRepository;

    private IndoorPositionResolver resolver;

    @BeforeEach
    void setUp() {
        resolver = new IndoorPositionResolver(routeNodeRepository, stationFloorRepository);
        when(stationFloorRepository.findByStationIdAndFloorCode(STATION, "B2"))
                .thenReturn(Optional.of(floor(B2_ID, "B2")));
    }

    @Test
    @DisplayName("위치는 노드에 붙이지 않고 변환한 좌표를 그대로 돌려준다")
    void reportsRawCoordinateNotTheSnappedNode() {
        // 가장 가까운 노드가 8m 떨어져 있어도 위치는 사용자가 실제로 선 자리여야 한다.
        givenNodes(node(11L, "B2_R001", "8.000", "0.000", "0.000"));

        AnchoredLocation got = resolver
                .resolve(STATION, "B2", new CanonicalPoint(0.0, 0.0, 0.0), null, 0.423)
                .orElseThrow();

        assertThat(got.mapX()).isEqualByComparingTo("0.000");
        assertThat(got.mapY()).isEqualByComparingTo("0.000");
        assertThat(got.mapZ()).isEqualByComparingTo("0.000");
        assertThat(got.floorId()).isEqualTo(B2_ID);
        assertThat(got.floorCode()).isEqualTo("B2");
        // 노드는 경로 진입점으로만 따로 담긴다.
        assertThat(got.startNodeId()).isEqualTo(11L);
        assertThat(got.startNodeDistanceM()).isEqualByComparingTo("8.000");
    }

    @Test
    @DisplayName("방향은 좌표와 함께 실어 보내고, 없으면 좌표만 돌려준다")
    void carriesDirectionAlongsideCoordinate() {
        givenNodes(node(11L, "B2_R001", "0.000", "0.000", "0.000"));
        CanonicalPoint point = new CanonicalPoint(0.0, 0.0, 0.0);

        AnchoredLocation withDirection = resolver
                .resolve(STATION, "B2", point, new CanonicalDirection(0.997524057, -0.070326069), 0.423)
                .orElseThrow();

        // 성분을 3자리로 자르면 벡터 길이가 1 에서 1e-3 까지 벗어난다. 6자리로 싣는다.
        assertThat(withDirection.forwardMapX()).isEqualByComparingTo("0.997524");
        assertThat(withDirection.forwardMapY()).isEqualByComparingTo("-0.070326");

        // 방향을 못 구해도 좌표까지 버리지 않는다. FE 가 WebXR 정렬만 못 하고 위치는 찍는다.
        AnchoredLocation withoutDirection = resolver
                .resolve(STATION, "B2", point, null, 0.423)
                .orElseThrow();

        assertThat(withoutDirection.forwardMapX()).isNull();
        assertThat(withoutDirection.forwardMapY()).isNull();
        assertThat(withoutDirection.mapX()).isEqualByComparingTo("0.000");
    }

    @Test
    @DisplayName("정확도는 그 층 정합 잔차를 그대로 싣는다")
    void carriesFrameResidualAsAccuracy() {
        givenNodes(node(11L, "B2_R001", "0.000", "0.000", "0.000"));

        AnchoredLocation got = resolver
                .resolve(STATION, "B2", new CanonicalPoint(0.0, 0.0, 0.0), null, 0.423)
                .orElseThrow();

        assertThat(got.accuracyM()).isEqualByComparingTo("0.423");
    }

    @Test
    @DisplayName("경로 진입 노드는 가장 가까운 하나만 고른다")
    void picksTheSingleNearestNodeAsRouteEntry() {
        givenNodes(
                node(11L, "먼쪽", "-10.000", "0.000", "0.000"),
                node(12L, "가까움", "1.000", "0.000", "0.000"),
                node(13L, "중간", "5.000", "0.000", "0.000"));

        AnchoredLocation got = resolver
                .resolve(STATION, "B2", new CanonicalPoint(0.0, 0.0, 0.0), null, 0.5)
                .orElseThrow();

        assertThat(got.startNodeId()).isEqualTo(12L);
    }

    @Test
    @DisplayName("같은 층 안에서 높이가 다른 노드는 3차원 거리로 갈라진다")
    void separatesNodesByHeightWithinTheSameFloor() {
        // 역삼역 B0.5 중간층은 별도 층이 아니라 B1 안의 map_z=7.5 다.
        // 평면상 같은 자리라도 바닥(z=5)과 중간층(z=7.5)이 섞이면 안 된다.
        givenNodes(
                node(21L, "바닥", "0.000", "0.000", "5.000"),
                node(22L, "중간층", "0.000", "0.000", "7.500"));

        AnchoredLocation got = resolver
                .resolve(STATION, "B2", new CanonicalPoint(0.0, 0.0, 5.0), null, 0.5)
                .orElseThrow();

        assertThat(got.startNodeId()).isEqualTo(21L);
    }

    @Test
    @DisplayName("높이가 없는 노드는 그 층 바닥에 있다고 보고 3차원으로 잰다")
    void treatsMissingHeightAsFloorLevel() {
        // 평면 거리로 대신하면 항상 3차원보다 짧아 높이 없는 노드가 구조적으로 유리해진다.
        // 관리자가 만든 노드는 map_z 를 넣을 경로가 없어 전부 비어 있으므로 늘 이겨버린다.
        givenNodes(
                node(31L, "높이없음", "3.000", "0.000", null),
                node(32L, "같은높이", "1.000", "0.000", "5.000"));

        AnchoredLocation got = resolver
                .resolve(STATION, "B2", new CanonicalPoint(0.0, 0.0, 5.0), null, 0.5)
                .orElseThrow();

        // 31 번을 z=5 로 보면 3m, 32 번은 1m 라 32 번이 이긴다.
        assertThat(got.startNodeId()).isEqualTo(32L);
        assertThat(got.startNodeDistanceM()).isEqualByComparingTo("1.000");
    }

    @Test
    @DisplayName("B2 시설 노드도 세부 이름 대신 대합실로 표시한다")
    void describesB2FacilityAsConcourse() {
        givenNodes(node(41L, "B2_F008", "0.000", "0.000", "0.000"));

        AnchoredLocation got = resolver
                .resolve(STATION, "B2", new CanonicalPoint(0.0, 0.0, 0.0), null, 0.5)
                .orElseThrow();

        assertThat(got.startNodeLabel()).isEqualTo("B2 · 대합실");
        assertThat(got.startNodeLabelEn()).isEqualTo("B2 · Concourse");
    }

    @Test
    @DisplayName("B2 복도 노드도 대합실로 표시한다")
    void describesB2PassageAsConcourse() {
        givenNodes(node(51L, "B2_R010", "0.000", "0.000", "0.000"));

        AnchoredLocation got = resolver
                .resolve(STATION, "B2", new CanonicalPoint(0.0, 0.0, 0.0), null, 0.5)
                .orElseThrow();

        assertThat(got.startNodeLabel()).isEqualTo("B2 · 대합실");
        assertThat(got.startNodeLabelEn()).isEqualTo("B2 · Concourse");
    }

    @Test
    @DisplayName("인접 시설이 있어도 세부 시설명을 노출하지 않는다")
    void omitsNearbyFacilityDetails() {
        RouteNode passage = node(61L, "B2_R010", "0.000", "0.000", "0.000");
        RouteNode gate = node(62L, "B2_F008", "5.000", "0.000", "0.000");
        givenNodes(passage, gate);

        AnchoredLocation got = resolver
                .resolve(STATION, "B2", new CanonicalPoint(0.0, 0.0, 0.0), null, 0.5)
                .orElseThrow();

        assertThat(got.startNodeLabel()).isEqualTo("B2 · 대합실");
        assertThat(got.startNodeLabelEn()).isEqualTo("B2 · Concourse");
    }

    @Test
    @DisplayName("시설과 거리가 멀어도 층 공간 유형만 표시한다")
    void omitsFacilityDistanceDetails() {
        RouteNode passage = node(71L, "B2_R001", "0.000", "0.000", "0.000");
        RouteNode pharmacy = node(72L, "B2_F001", "15.000", "0.000", "0.000");
        givenNodes(passage, pharmacy);

        AnchoredLocation got = resolver
                .resolve(STATION, "B2", new CanonicalPoint(0.0, 0.0, 0.0), null, 0.5)
                .orElseThrow();

        assertThat(got.startNodeLabel()).isEqualTo("B2 · 대합실");
        assertThat(got.startNodeLabelEn()).isEqualTo("B2 · Concourse");
    }

    @Test
    @DisplayName("B3 노드는 위치와 관계없이 승강장으로 표시한다")
    void describesB3AsPlatform() {
        when(stationFloorRepository.findByStationIdAndFloorCode(STATION, "B3"))
                .thenReturn(Optional.of(floor(B3_ID, "B3")));
        List<RouteNode> nodes = List.of(
                node(81L, B3_ID, "B3_R001", "-90.000", "0.000", "-5.000"),
                node(82L, B3_ID, "B3_R010", "0.000", "0.000", "-5.000"),
                node(83L, B3_ID, "B3_R016", "90.000", "0.000", "-5.000")
        );
        when(routeNodeRepository.search(STATION, B3_ID)).thenReturn(nodes);

        AnchoredLocation got = resolver
                .resolve(STATION, "B3", new CanonicalPoint(-90.0, 0.0, -5.0), null, 0.5)
                .orElseThrow();

        assertThat(got.startNodeLabel()).isEqualTo("B3 · 승강장");
        assertThat(got.startNodeLabelEn()).isEqualTo("B3 · Platform");
    }

    @Test
    @DisplayName("층이나 노드를 찾지 못하면 위치를 확정하지 않는다")
    void returnsEmptyWhenFloorOrNodesMissing() {
        assertThat(resolver.resolve(STATION, null, new CanonicalPoint(0, 0, 0), null, 0.5)).isEmpty();
        assertThat(resolver.resolve(STATION, "  ", new CanonicalPoint(0, 0, 0), null, 0.5)).isEmpty();

        when(stationFloorRepository.findByStationIdAndFloorCode(STATION, "B9"))
                .thenReturn(Optional.empty());
        assertThat(resolver.resolve(STATION, "B9", new CanonicalPoint(0, 0, 0), null, 0.5)).isEmpty();

        givenNodes();
        assertThat(resolver.resolve(STATION, "B2", new CanonicalPoint(0, 0, 0), null, 0.5)).isEmpty();
    }

    @Test
    @DisplayName("알 수 없는 공간 유형은 역사 내부로 안전하게 표시한다")
    void fallsBackForUnknownSpaceType() {
        StationFloor floor = floor(4L, "B4", "unknown");
        when(stationFloorRepository.findByStationIdAndFloorCode(STATION, "B4"))
                .thenReturn(Optional.of(floor));
        RouteNode node = node(91L, 4L, "B4_R001", "0.000", "0.000", "-10.000");
        when(routeNodeRepository.search(STATION, 4L)).thenReturn(List.of(node));

        AnchoredLocation got = resolver
                .resolve(STATION, " b4 ", new CanonicalPoint(0.0, 0.0, -10.0), null, 0.5)
                .orElseThrow();

        assertThat(got.floorCode()).isEqualTo("B4");
        assertThat(got.startNodeLabel()).isEqualTo("B4 · 역사 내부");
        assertThat(got.startNodeLabelEn()).isEqualTo("B4 · Station interior");
    }

    private void givenNodes(RouteNode... nodes) {
        when(routeNodeRepository.search(STATION, B2_ID)).thenReturn(List.of(nodes));
    }

    private RouteNode node(Long id, String name, String x, String y, String z) {
        return node(id, B2_ID, name, x, y, z);
    }

    private RouteNode node(Long id, Long floorId, String name, String x, String y, String z) {
        RouteNode n = RouteNode.create(STATION, floorId, "normal", name,
                new BigDecimal(x), new BigDecimal(y), null, false);
        ReflectionTestUtils.setField(n, "id", id);
        ReflectionTestUtils.setField(n, "mapZ", z == null ? null : new BigDecimal(z));
        return n;
    }

    private StationFloor floor(Long id, String code) {
        String spaceType = "B3".equals(code) ? "platform" : "concourse";
        return floor(id, code, spaceType);
    }

    private StationFloor floor(Long id, String code, String spaceType) {
        Station station = Station.create("역삼역", "Yeoksam", "2호선", null, null);
        StationFloor f = StationFloor.create(station, code, "지하", spaceType, 1, null);
        ReflectionTestUtils.setField(f, "id", id);
        return f;
    }
}
