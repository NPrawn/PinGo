package com.pingo.backend.localization.anchoring;

import com.pingo.backend.localization.anchoring.VpsAnchoringProperties.FloorFrame;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * AI 위치추정이 돌려준 COLMAP 좌표를 캐노니컬 평면도 좌표로 옮긴다.
 *
 * <p>변환 계수는 역·층마다 다르다({@link VpsAnchoringProperties}). 해당 조합의 계수가 없으면
 * 변환하지 않고 비어 있는 결과를 돌려준다 — 0 으로 계산해 그럴듯한 오답을 내는 것보다
 * 위치를 모른다고 답하는 편이 낫다.
 */
@Component
@RequiredArgsConstructor
public class ColmapToCanonicalMapper {

    private static final int COORDINATE_COUNT = 3;

    private final VpsAnchoringProperties properties;

    /**
     * @param stationId    요청한 역 ID
     * @param floorCode    AI 응답의 층 코드
     * @param cameraCenter COLMAP 좌표계의 카메라 중심 [x, y, z]
     * @return 캐노니컬 좌표. 계수가 없거나 입력이 온전하지 않으면 비어 있다.
     */
    public Optional<CanonicalPoint> toCanonical(Long stationId, String floorCode, List<Double> cameraCenter) {
        FloorFrame frame = properties.frameOf(stationId, floorCode);
        if (frame == null || !isUsable(cameraCenter)) {
            return Optional.empty();
        }

        double cx = cameraCenter.get(0);
        double cy = cameraCenter.get(1);
        double cz = cameraCenter.get(2);
        double[] m = frame.m();

        return Optional.of(new CanonicalPoint(
                m[0] * cx + m[1] * cy + m[2] * cz + frame.offset()[0],
                m[3] * cx + m[4] * cy + m[5] * cz + frame.offset()[1],
                frame.nominalZ()
        ));
    }

    /**
     * 해당 역·층의 위치 정확도(m). leave-one-out 평균이다. 계수가 없으면 비어 있다.
     */
    public Optional<Double> accuracyOf(Long stationId, String floorCode) {
        FloorFrame frame = properties.frameOf(stationId, floorCode);
        return frame == null ? Optional.empty() : Optional.of(frame.accuracyM());
    }

    /**
     * 해당 역·층 바닥의 캐노니컬 높이. 높이가 없는 노드의 기본값으로도 쓴다.
     */
    public Optional<Double> nominalZOf(Long stationId, String floorCode) {
        FloorFrame frame = properties.frameOf(stationId, floorCode);
        return frame == null ? Optional.empty() : Optional.of(frame.nominalZ());
    }

    private boolean isUsable(List<Double> cameraCenter) {
        return cameraCenter != null
                && cameraCenter.size() == COORDINATE_COUNT
                && cameraCenter.stream().allMatch(value -> value != null && Double.isFinite(value));
    }
}
