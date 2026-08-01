package com.pingo.backend.localization.anchoring;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pingo.backend.localization.anchoring.VpsAnchoringProperties.FloorFrame;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

/**
 * 좌표 정합이 설정·산출물·코드 세 곳에서 어긋나지 않는지 확인한다.
 *
 * <p>다른 테스트가 계수를 상수로 박아두는 것과 달리, 여기서는 <b>실제로 배포되는
 * {@code application.yaml}</b> 을 읽어 {@code ai/tools/colmap_align_result.json} 의 기준점
 * 14개를 전부 통과시키고 기록된 잔차와 대조한다.
 *
 * <p>계수를 바꾸면서 산출물 갱신을 빠뜨리거나, 산출물만 고치고 설정을 안 바꾸면 여기서 깨진다.
 * 정합을 다시 돌렸다면 두 파일을 함께 갱신해야 한다.
 */
class VpsAnchoringAlignmentTest {

    /** 계수·기준점이 같으면 소수 셋째 자리까지 일치한다. 반올림 여유만 둔다. */
    private static final double TOLERANCE_M = 0.002;

    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    @DisplayName("application.yaml 계수로 기준점 14개를 변환하면 기록된 잔차와 일치한다")
    void configReproducesRecordedResiduals() throws Exception {
        ColmapToCanonicalMapper mapper = new ColmapToCanonicalMapper(loadProperties());
        JsonNode floors = loadAlignmentResult().get("floors");

        List<String> mismatches = new ArrayList<>();
        floors.fieldNames().forEachRemaining(floorCode -> {
            JsonNode floor = floors.get(floorCode);
            JsonNode recorded = floor.get("verification").get("per_point_residual_xy_m");
            JsonNode points = floor.get("control_points");

            for (int i = 0; i < points.size(); i++) {
                JsonNode point = points.get(i);
                JsonNode colmap = point.get("colmap");
                CanonicalPoint got = mapper.toCanonical(
                                stationIdOf(floor),
                                floorCode,
                                List.of(colmap.get(0).asDouble(), colmap.get(1).asDouble(), colmap.get(2).asDouble()))
                        .orElseThrow(() -> new AssertionError(
                                floorCode + " 계수가 application.yaml 에 없다"));

                JsonNode canonical = point.get("canonical");
                double residual = Math.hypot(
                        got.x() - canonical.get(0).asDouble(),
                        got.y() - canonical.get(1).asDouble());
                double expected = recorded.get(i).asDouble();
                if (Math.abs(residual - expected) > TOLERANCE_M) {
                    mismatches.add("%s %s: 잔차 %.3f m, 기록 %.3f m"
                            .formatted(floorCode, point.get("name").asText(), residual, expected));
                }
                assertThat(got.z()).isEqualTo(floor.get("nominal_z").asDouble());
            }
        });

        assertThat(mismatches)
                .as("application.yaml 과 colmap_align_result.json 이 어긋난다. 정합을 다시 돌렸다면 둘 다 갱신해야 한다")
                .isEmpty();
    }

    @Test
    @DisplayName("응답에 싣는 정확도가 산출물의 leave-one-out 평균과 같다")
    void accuracyMatchesRecordedGeneralizationError() throws Exception {
        ColmapToCanonicalMapper mapper = new ColmapToCanonicalMapper(loadProperties());
        JsonNode floors = loadAlignmentResult().get("floors");

        floors.fieldNames().forEachRemaining(floorCode -> {
            JsonNode floor = floors.get(floorCode);
            double recorded = floor.get("accuracy_m_used_by_backend").asDouble();
            // in-sample 잔차가 아니라 일반화 오차를 실어야 한다.
            assertThat(recorded).isEqualTo(floor.get("verification").get("leave_one_out_mean_m").asDouble());
            assertThat(mapper.accuracyOf(stationIdOf(floor), floorCode)).contains(recorded);
        });
    }

    @Test
    @DisplayName("두 층이 공유하는 엘리베이터의 불일치가 기록값과 같다")
    void floorLinkDisagreementMatchesRecord() throws Exception {
        ColmapToCanonicalMapper mapper = new ColmapToCanonicalMapper(loadProperties());
        JsonNode root = loadAlignmentResult();
        JsonNode link = root.get("floor_link");

        CanonicalPoint fromB2 = mapper.toCanonical(1L, "B2", elevatorColmap(root, "B2")).orElseThrow();
        CanonicalPoint fromB3 = mapper.toCanonical(1L, "B3", elevatorColmap(root, "B3")).orElseThrow();
        double gap = Math.hypot(fromB2.x() - fromB3.x(), fromB2.y() - fromB3.y());

        // 층마다 별개의 COLMAP 재구성이라 이 값이 층 전환 시 표시 위치가 튀는 폭이다.
        assertThat(gap).isCloseTo(link.get("disagreement_m").asDouble(), within(TOLERANCE_M));
    }

    private static List<Double> elevatorColmap(JsonNode root, String floorCode) {
        for (JsonNode point : root.get("floors").get(floorCode).get("control_points")) {
            if ("EV_A".equals(point.get("name").asText())) {
                JsonNode c = point.get("colmap");
                return List.of(c.get(0).asDouble(), c.get(1).asDouble(), c.get(2).asDouble());
            }
        }
        throw new AssertionError(floorCode + " 기준점에 EV_A 가 없다");
    }

    private static Long stationIdOf(JsonNode floor) {
        // 산출물에는 역이 없다. 역삼역 전용 재구성이라 설정과 같은 역으로 본다.
        return 1L;
    }

    @SuppressWarnings("unchecked")
    private static VpsAnchoringProperties loadProperties() throws Exception {
        try (InputStream in = VpsAnchoringAlignmentTest.class.getResourceAsStream("/application.yaml")) {
            Map<String, Object> root = new Yaml().load(in);
            Map<String, Object> floors = (Map<String, Object>)
                    ((Map<String, Object>) ((Map<String, Object>) root.get("vps")).get("anchoring")).get("floors");

            Map<String, FloorFrame> frames = new HashMap<>();
            floors.forEach((code, raw) -> {
                Map<String, Object> f = (Map<String, Object>) raw;
                frames.put(code, new FloorFrame(
                        ((Number) f.get("station-id")).longValue(),
                        doubles((List<Number>) f.get("m")),
                        doubles((List<Number>) f.get("offset")),
                        ((Number) f.get("nominal-z")).doubleValue(),
                        ((Number) f.get("accuracy-m")).doubleValue()));
            });
            return new VpsAnchoringProperties(frames);
        }
    }

    private static double[] doubles(List<Number> values) {
        double[] out = new double[values.size()];
        for (int i = 0; i < out.length; i++) {
            out[i] = values.get(i).doubleValue();
        }
        return out;
    }

    /** 저장소 어디서 테스트를 돌리든 찾도록 상위로 거슬러 올라간다. */
    private static JsonNode loadAlignmentResult() throws Exception {
        Path dir = Path.of("").toAbsolutePath();
        for (int depth = 0; depth < 5 && dir != null; depth++, dir = dir.getParent()) {
            Path candidate = dir.resolve("ai/tools/colmap_align_result.json");
            if (Files.exists(candidate)) {
                return JSON.readTree(Files.readString(candidate));
            }
        }
        throw new AssertionError("ai/tools/colmap_align_result.json 을 찾지 못했다");
    }
}
