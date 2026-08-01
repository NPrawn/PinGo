package com.pingo.backend.localization.anchoring;

import com.pingo.backend.localization.anchoring.VpsAnchoringProperties.FloorFrame;
import org.assertj.core.data.Offset;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class ColmapToCanonicalMapperTest {

    private static final Long YEOKSAM = 1L;
    private static final Offset<Double> ONE_METER = Offset.offset(1.0);
    private static final Offset<Double> UNIT_VECTOR = Offset.offset(1e-6);

    // application.yaml 과 같은 값. colmap_aliked_lightglue_v3 의 B2/sparse/0 · B3/sparse/1 재정합 결과.
    private static final FloorFrame B2 = new FloorFrame(YEOKSAM,
            new double[]{0.157222117, -0.906216753, 5.731709510, 5.568476835, -1.589723009, -0.404089100},
            new double[]{-40.354147323, 22.557001580}, 0.0, 0.497);
    private static final FloorFrame B3 = new FloorFrame(YEOKSAM,
            new double[]{-2.468273427, -1.090468751, 3.101513306, 3.148597120, 0.331852178, 2.622420809},
            new double[]{-27.907908218, 24.804151243}, -5.0, 1.095);

    private final ColmapToCanonicalMapper mapper =
            new ColmapToCanonicalMapper(new VpsAnchoringProperties(Map.of("B2", B2, "B3", B3)));

    @Test
    @DisplayName("B2 정합 기준점을 넣으면 실제 캐노니컬 좌표 근처로 옮겨진다")
    void mapsB2ControlPointBackToCanonical() {
        // 기준점 'a' — 정합 당시 잔차 0.160m
        Optional<CanonicalPoint> p = mapper.toCanonical(
                YEOKSAM, "B2", List.of(2.1271062606, -0.0961082567, -3.9076615345));

        assertThat(p).isPresent();
        assertThat(p.get().x()).isCloseTo(-62.336, ONE_METER);
        assertThat(p.get().y()).isCloseTo(35.974, ONE_METER);
        assertThat(p.get().z()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("B3 정합 기준점도 마찬가지이고 높이는 층 기준값이 들어간다")
    void mapsB3ControlPointAndUsesNominalHeight() {
        // 기준점 'EV_A' — B2·B3 두 모델을 잇는 엘리베이터
        Optional<CanonicalPoint> p = mapper.toCanonical(
                YEOKSAM, "B3", List.of(-3.6463339395, -1.6740893583, 5.4997841556));

        assertThat(p).isPresent();
        assertThat(p.get().x()).isCloseTo(-0.401, ONE_METER);
        assertThat(p.get().y()).isCloseTo(27.200, ONE_METER);
        // 변환으로 얻은 값이 아니라 B3 바닥 높이다.
        assertThat(p.get().z()).isEqualTo(-5.0);
    }

    @Test
    @DisplayName("같은 엘리베이터를 두 층 계수로 옮기면 노드 간격보다 훨씬 가깝게 만난다")
    void twoFloorsAgreeAtTheSharedElevator() {
        CanonicalPoint fromB2 = mapper.toCanonical(
                YEOKSAM, "B2", List.of(1.0736587455, -1.1765271796, 6.6548534318)).orElseThrow();
        CanonicalPoint fromB3 = mapper.toCanonical(
                YEOKSAM, "B3", List.of(-3.6463339395, -1.6740893583, 5.4997841556)).orElseThrow();

        // 층마다 별개의 COLMAP 재구성이라 이 값이 층 전환 시 표시 위치가 튀는 폭이 된다.
        // 현재 1.087m 이고, 노드 최근접 간격(B2 6.9m · B3 7.7m)보다 훨씬 작아 경로 진입 노드가 바뀌지 않는다.
        double gap = Math.hypot(fromB2.x() - fromB3.x(), fromB2.y() - fromB3.y());
        assertThat(gap).isLessThan(2.0);
    }

    @Test
    @DisplayName("역이 다르면 층 코드가 같아도 계수를 쓰지 않는다")
    void doesNotApplyAnotherStationsFrame() {
        // 층 코드 B1·B2·B3 는 역마다 겹친다. 역을 대조하지 않으면 역삼역 계수가
        // 다른 역 요청에 적용돼 수십 미터 어긋난 좌표가 오류 없이 나간다.
        assertThat(mapper.toCanonical(2L, "B2", List.of(1.0, 2.0, 3.0))).isEmpty();
        assertThat(mapper.accuracyOf(2L, "B2")).isEmpty();
        assertThat(mapper.toCanonical(null, "B2", List.of(1.0, 2.0, 3.0))).isEmpty();
    }

    @Test
    @DisplayName("정합 계수가 없는 층은 변환하지 않는다")
    void returnsEmptyForFloorWithoutFrame() {
        // 역삼역 B1 은 COLMAP 커버가 없어 계수 자체가 없다.
        assertThat(mapper.toCanonical(YEOKSAM, "B1", List.of(1.0, 2.0, 3.0))).isEmpty();
        assertThat(mapper.accuracyOf(YEOKSAM, "B1")).isEmpty();
        assertThat(mapper.nominalZOf(YEOKSAM, "B1")).isEmpty();
    }

    @Test
    @DisplayName("층 코드나 좌표가 온전하지 않으면 변환하지 않는다")
    void returnsEmptyForUnusableInput() {
        assertThat(mapper.toCanonical(YEOKSAM, null, List.of(1.0, 2.0, 3.0))).isEmpty();
        assertThat(mapper.toCanonical(YEOKSAM, "B2", null)).isEmpty();
        assertThat(mapper.toCanonical(YEOKSAM, "B2", List.of(1.0, 2.0))).isEmpty();
        assertThat(mapper.toCanonical(YEOKSAM, "B2", Arrays.asList(1.0, null, 3.0))).isEmpty();
        assertThat(mapper.toCanonical(YEOKSAM, "B2", List.of(1.0, Double.NaN, 3.0))).isEmpty();
    }

    @Test
    @DisplayName("정확도는 in-sample 잔차가 아니라 leave-one-out 평균이다")
    void exposesGeneralizationErrorAsAccuracy() {
        // in-sample RMS 는 B2 0.423 · B3 0.594 지만 그 값은 기준점으로 맞춘 것이라 낙관적이다.
        assertThat(mapper.accuracyOf(YEOKSAM, "B2")).contains(0.497);
        assertThat(mapper.accuracyOf(YEOKSAM, "B3")).contains(1.095);
    }

    @Test
    @DisplayName("층 기준 높이를 돌려준다")
    void exposesNominalHeightPerFloor() {
        assertThat(mapper.nominalZOf(YEOKSAM, "B2")).contains(0.0);
        assertThat(mapper.nominalZOf(YEOKSAM, "B3")).contains(-5.0);
    }

    // ── forwardMap (FE 스펙 8.5) ───────────────────────────────────────────────

    @Test
    @DisplayName("회전 쿼터니언을 캐노니컬 수평면 단위벡터로 옮긴다")
    void mapsRotationToCanonicalUnitVector() {
        // 항등 쿼터니언이면 forward_colmap = Rᵀ[0,0,1]ᵀ = (0,0,1) 이고,
        // 여기에 B2 선형부 3열 (5.731710, -0.404089) 를 적용해 정규화한 값이다.
        CanonicalDirection d = mapper
                .toCanonicalDirection(YEOKSAM, "B2", List.of(0.0, 0.0, 0.0, 1.0))
                .orElseThrow();

        assertThat(d.x()).isCloseTo(0.997524, UNIT_VECTOR);
        assertThat(d.y()).isCloseTo(-0.070326, UNIT_VECTOR);
        assertThat(Math.hypot(d.x(), d.y())).isCloseTo(1.0, UNIT_VECTOR);
    }

    @Test
    @DisplayName("수평축 둘레로 고개를 들거나 숙여도 방향이 바뀌지 않는다")
    void ignoresPitchAboutAHorizontalAxis() {
        // 선형부의 영공간이 이 층 COLMAP 수직 방향이라 전방의 수직 성분이 정확히 소거된다.
        // 아래 쿼터니언은 항등에서 지도 수평축 둘레로 35도 기울인 것이다.
        CanonicalDirection level = mapper
                .toCanonicalDirection(YEOKSAM, "B2", List.of(0.0, 0.0, 0.0, 1.0))
                .orElseThrow();
        CanonicalDirection pitched = mapper
                .toCanonicalDirection(YEOKSAM, "B2",
                        List.of(-0.288310402, 0.085446416, 0.0, 0.953716951))
                .orElseThrow();

        assertThat(pitched.x()).isCloseTo(level.x(), UNIT_VECTOR);
        assertThat(pitched.y()).isCloseTo(level.y(), UNIT_VECTOR);
    }

    @Test
    @DisplayName("카메라가 바닥·천장을 정면으로 보면 방향을 비운다")
    void returnsEmptyWhenCameraLooksAlongTheVertical() {
        // 전방이 영공간과 나란하면 수평 방향이 정의되지 않는다. 값이 나오더라도 잡음이다.
        assertThat(mapper.toCanonicalDirection(YEOKSAM, "B2",
                List.of(0.627861073, -0.186078886, 0.0, 0.755754670))).isEmpty();
    }

    @Test
    @DisplayName("정규화되지 않은 쿼터니언도 같은 방향을 낸다")
    void normalizesTheIncomingQuaternion() {
        CanonicalDirection unit = mapper
                .toCanonicalDirection(YEOKSAM, "B2", List.of(0.0, 0.0, 0.0, 1.0))
                .orElseThrow();
        CanonicalDirection scaled = mapper
                .toCanonicalDirection(YEOKSAM, "B2", List.of(0.0, 0.0, 0.0, 2.5))
                .orElseThrow();

        assertThat(scaled.x()).isCloseTo(unit.x(), UNIT_VECTOR);
        assertThat(scaled.y()).isCloseTo(unit.y(), UNIT_VECTOR);
    }

    @Test
    @DisplayName("계수가 없거나 회전이 온전하지 않으면 방향을 비운다")
    void returnsEmptyDirectionForUnusableInput() {
        List<Double> identity = List.of(0.0, 0.0, 0.0, 1.0);

        // 역삼역 B1 은 계수가 없고, 다른 역에는 역삼역 계수를 쓰지 않는다.
        assertThat(mapper.toCanonicalDirection(YEOKSAM, "B1", identity)).isEmpty();
        assertThat(mapper.toCanonicalDirection(2L, "B2", identity)).isEmpty();
        assertThat(mapper.toCanonicalDirection(null, "B2", identity)).isEmpty();
        assertThat(mapper.toCanonicalDirection(YEOKSAM, null, identity)).isEmpty();

        // AI 가 회전을 주지 않는 경우가 있다. 좌표만 있고 방향이 없는 응답이 정상 경로다.
        assertThat(mapper.toCanonicalDirection(YEOKSAM, "B2", null)).isEmpty();
        assertThat(mapper.toCanonicalDirection(YEOKSAM, "B2", List.of(0.0, 0.0, 1.0))).isEmpty();
        assertThat(mapper.toCanonicalDirection(YEOKSAM, "B2", Arrays.asList(0.0, null, 0.0, 1.0))).isEmpty();
        assertThat(mapper.toCanonicalDirection(YEOKSAM, "B2", List.of(0.0, Double.NaN, 0.0, 1.0))).isEmpty();
        assertThat(mapper.toCanonicalDirection(YEOKSAM, "B2", List.of(0.0, 0.0, 0.0, 0.0))).isEmpty();
    }
}
