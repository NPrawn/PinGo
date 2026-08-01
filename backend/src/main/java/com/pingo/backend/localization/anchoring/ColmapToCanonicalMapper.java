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
 *
 * <p>옮기는 것은 두 가지다. 카메라 중심은 {@link #toCanonical}, 카메라가 향한 방향은
 * {@link #toCanonicalDirection} 이 맡는다. 같은 계수를 쓰지만 방향에는 평행이동을 적용하지 않는다.
 */
@Component
@RequiredArgsConstructor
public class ColmapToCanonicalMapper {

    private static final int COORDINATE_COUNT = 3;
    private static final int QUATERNION_COMPONENT_COUNT = 4;

    /**
     * 방향을 산출할 수 있는 최소 수평 성분. 단위벡터 기준이라 수평에서 약 5.7도에 해당한다.
     *
     * <p>카메라가 바닥이나 천장을 정면으로 보면 수평 방향이 정의되지 않는다. 그 부근에서는
     * 값이 나오더라도 잡음이 지배하므로 방향을 비운다.
     */
    private static final double MIN_HORIZONTAL_COMPONENT = 0.1;

    private static final double EPSILON = 1e-9;

    private final VpsAnchoringProperties properties;

    /**
     * @param stationId    요청한 역 ID
     * @param floorCode    AI 응답의 층 코드
     * @param cameraCenter COLMAP 좌표계의 카메라 중심 [x, y, z]
     * @return 캐노니컬 좌표. 계수가 없거나 입력이 온전하지 않으면 비어 있다.
     */
    public Optional<CanonicalPoint> toCanonical(Long stationId, String floorCode, List<Double> cameraCenter) {
        FloorFrame frame = properties.frameOf(stationId, floorCode);
        if (frame == null || !isUsable(cameraCenter, COORDINATE_COUNT)) {
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
     * 앵커 시점 카메라가 향한 방향을 캐노니컬 수평면 단위벡터로 옮긴다(FE 스펙 8.5 {@code forwardMap}).
     *
     * <p>FE 는 WebXR 프레임 기준 전방({@code forwardXr})은 스스로 알지만 그게 지도에서 어느
     * 쪽인지는 모른다. 두 값의 각도 차가 XR↔지도 회전이고, 그게 있어야 WebXR 이동량을 지도 위
     * 이동으로 바꿀 수 있다. 지도 기준 방향은 VPS 포즈에만 들어 있다.
     *
     * <p>산출은 파이프라인 설계서 8.1 을 따른다. COLMAP 이 푼 회전 {@code R} 은 world → camera
     * 이고 카메라는 자기 좌표계의 +Z 를 보므로, 월드 기준 전방은 {@code Rᵀ[0,0,1]ᵀ} 즉 {@code R}
     * 의 3행이다. 여기에 어파인의 선형부만 적용하고 정규화한다.
     *
     * <p><b>수평축 둘레로 고개를 들거나 숙여도 방향은 그대로다.</b> 평면 정렬 sim3 로 맞춘
     * 계수라 선형부의 영공간이 그 층 COLMAP 좌표계의 수직 방향과 일치하고, 전방에 섞인 수직
     * 성분은 곱하는 과정에서 정확히 소거된다. 역삼역 B2 계수의 영공간은
     * {@code (0.281260, 0.949018, 0.142330)} 이다.
     *
     * <p>소거되는 것은 <b>수직 성분이지 회전 자체가 아니다.</b> 수평이 아닌 축 둘레로 돌리면
     * 방향은 당연히 바뀐다. 이 층에서 COLMAP x 축은 수평이 아니라서(영공간과 내적 0.281) 그 축
     * 둘레로 30도 돌리면 결과가 9도쯤 움직인다.
     *
     * <p><b>정규화는 백엔드가 한다.</b> 길이 1 로 맞춰 내보내므로 FE 가 다시 정규화할 필요가 없다.
     * 단위벡터라 캐노니컬 미터의 축척과도 무관하다 — 배율은 정규화에서 사라진다.
     *
     * @param stationId    요청한 역 ID
     * @param floorCode    AI 응답의 층 코드
     * @param rotationXyzw COLMAP world → camera 회전 쿼터니언 [x, y, z, w]
     * @return 캐노니컬 수평면 단위벡터. 계수가 없거나 입력이 온전하지 않거나 카메라가 수직에
     *         가까우면 비어 있다.
     */
    public Optional<CanonicalDirection> toCanonicalDirection(
            Long stationId,
            String floorCode,
            List<Double> rotationXyzw
    ) {
        FloorFrame frame = properties.frameOf(stationId, floorCode);
        if (frame == null || !isUsable(rotationXyzw, QUATERNION_COMPONENT_COUNT)) {
            return Optional.empty();
        }

        double qx = rotationXyzw.get(0);
        double qy = rotationXyzw.get(1);
        double qz = rotationXyzw.get(2);
        double qw = rotationXyzw.get(3);
        double norm = Math.sqrt(qx * qx + qy * qy + qz * qz + qw * qw);
        if (norm < EPSILON) {
            return Optional.empty();
        }
        qx /= norm;
        qy /= norm;
        qz /= norm;
        qw /= norm;

        // forward_colmap = Rᵀ[0,0,1]ᵀ = R 의 3행.
        double fx = 2 * (qx * qz - qy * qw);
        double fy = 2 * (qy * qz + qx * qw);
        double fz = 1 - 2 * (qx * qx + qy * qy);

        double[] m = frame.m();
        if (horizontalComponentOf(m, fx, fy, fz) < MIN_HORIZONTAL_COMPONENT) {
            return Optional.empty();
        }

        double dx = m[0] * fx + m[1] * fy + m[2] * fz;
        double dy = m[3] * fx + m[4] * fy + m[5] * fz;
        double length = Math.hypot(dx, dy);
        if (length < EPSILON) {
            return Optional.empty();
        }

        return Optional.of(new CanonicalDirection(dx / length, dy / length));
    }

    /**
     * 해당 역·층의 위치 정확도(m). leave-one-out 평균이다. 계수가 없으면 비어 있다.
     */
    public Optional<Double> accuracyOf(Long stationId, String floorCode) {
        FloorFrame frame = properties.frameOf(stationId, floorCode);
        return frame == null ? Optional.empty() : Optional.of(frame.accuracyM());
    }

    /**
     * 단위 방향 {@code (fx, fy, fz)} 중 지도 평면에 남는 성분의 크기(0~1).
     *
     * <p>어파인 선형부 두 행의 외적이 이 층 COLMAP 좌표계의 수직 방향이다. 선형부가 그 방향을
     * 소거하므로, 전방에서 수직 성분을 뺀 나머지가 방향을 실제로 결정하는 몫이다.
     */
    private double horizontalComponentOf(double[] m, double fx, double fy, double fz) {
        double nx = m[1] * m[5] - m[2] * m[4];
        double ny = m[2] * m[3] - m[0] * m[5];
        double nz = m[0] * m[4] - m[1] * m[3];
        double normal = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (normal < EPSILON) {
            return 0;
        }

        double vertical = (fx * nx + fy * ny + fz * nz) / normal;
        return Math.sqrt(Math.max(0, 1 - vertical * vertical));
    }

    private boolean isUsable(List<Double> values, int expectedSize) {
        return values != null
                && values.size() == expectedSize
                && values.stream().allMatch(value -> value != null && Double.isFinite(value));
    }
}
