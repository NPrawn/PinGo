package com.pingo.backend.localization.anchoring;

import com.pingo.backend.localization.anchoring.VpsAnchoringProperties.FloorFrame;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 설정 계수가 온전하지 않으면 기동 단계에서 걸리는지 확인한다.
 *
 * <p>{@link ColmapToCanonicalMapper#accuracyOf}·{@code nominalZOf} 가 {@code Optional.of} 를
 * 쓰는 근거다. 값이 {@code null} 인 프레임은 애초에 바인딩을 통과하지 못하므로 그 지점에서
 * {@code null} 을 방어할 필요가 없다. 방어하면 "계수가 없다"와 "계수는 있는데 값이 비었다"가
 * 같은 {@code Optional.empty()} 로 뭉개진다.
 */
class VpsAnchoringPropertiesValidationTest {

    private static final double[] M = {1, 0, 0, 0, 1, 0};
    private static final double[] OFFSET = {0, 0};

    private final Validator validator = validator();

    @Test
    @DisplayName("층 계수에 값이 빠지면 검증에 걸린다")
    void rejectsFloorFrameWithMissingValues() {
        assertThat(violationPaths(new FloorFrame(1L, M, OFFSET, null, 0.5)))
                .contains("floors[B2].nominalZ");
        assertThat(violationPaths(new FloorFrame(1L, M, OFFSET, 0.0, null)))
                .contains("floors[B2].accuracyM");
        assertThat(violationPaths(new FloorFrame(null, M, OFFSET, 0.0, 0.5)))
                .contains("floors[B2].stationId");
        assertThat(violationPaths(new FloorFrame(1L, null, OFFSET, 0.0, 0.5)))
                .contains("floors[B2].m");
        assertThat(violationPaths(new FloorFrame(1L, new double[]{1, 0, 0}, OFFSET, 0.0, 0.5)))
                .contains("floors[B2].m");
    }

    @Test
    @DisplayName("온전한 계수는 통과한다")
    void acceptsCompleteFloorFrame() {
        assertThat(violationPaths(new FloorFrame(1L, M, OFFSET, 0.0, 0.5))).isEmpty();
    }

    private java.util.List<String> violationPaths(FloorFrame frame) {
        return validator.validate(new VpsAnchoringProperties(Map.of("B2", frame))).stream()
                .map(violation -> violation.getPropertyPath().toString())
                .toList();
    }

    private static Validator validator() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            return factory.getValidator();
        }
    }
}
