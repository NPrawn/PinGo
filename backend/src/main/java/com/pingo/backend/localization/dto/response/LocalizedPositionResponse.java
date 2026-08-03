package com.pingo.backend.localization.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

/**
 * 위치 인식으로 확정한 사용자의 실내 위치. 캐노니컬 평면도 좌표(미터)이며 지도에 점으로 찍는다.
 *
 * <p>노드에 붙이지 않은 <b>날 좌표</b>다. 경로 노드는 20~30m 간격의 경유점이라 위치 표시에 쓰면
 * 실제와 최대 10m 어긋난다. 노드는 경로 탐색 진입점으로만 쓰고, 그 값은
 * {@link LocalizationResponse#startNodeId()} 에 따로 담는다.
 *
 * <p>좌표와 함께 앵커 시점의 <b>방향</b>({@code forwardMap})도 담는다. 둘이 한 쌍이어야 FE 가
 * WebXR 좌표를 지도에 정렬할 수 있다(FE 스펙 8.2·8.5).
 */
@Schema(description = "위치 인식으로 확정한 실내 위치. 캐노니컬 미터 좌표이며 지도에 그대로 표시한다.")
public record LocalizedPositionResponse(

        @Schema(description = "층 ID", example = "2")
        Long floorId,

        @Schema(description = "층 코드", example = "B2")
        @NotBlank
        String floorCode,

        @Schema(description = "캐노니컬 X (m)", example = "-0.975")
        BigDecimal mapX,

        @Schema(description = "캐노니컬 Y (m)", example = "27.717")
        BigDecimal mapY,

        @Schema(
                description = "캐노니컬 Z (m). 해당 층의 기준 높이이며 위치추정으로 얻은 값이 아니다.",
                example = "0.0"
        )
        BigDecimal mapZ,

        @Schema(
                description = """
                        앵커 시점 단말이 향한 방향. 캐노니컬 수평면 2D 단위벡터다(FE 스펙 8.5).

                        FE 는 같은 순간의 WebXR 전방(forwardXr)을 스스로 알고 있고, 이 값과의 각도 차가
                        XR↔지도 회전이다. 그게 있어야 WebXR 이동량을 지도 위 이동으로 바꿀 수 있다.

                        AI 가 회전을 주지 않거나 카메라가 바닥·천장을 정면으로 볼 때는 null 이다.
                        방향이 틀려도 오류가 나지 않고 마커만 엉뚱하게 움직이므로, null 이면
                        WebXR 정렬을 시작하지 않는 편이 안전하다.
                        """,
                nullable = true
        )
        PlanarDirectionResponse forwardMap,

        @Schema(
                description = """
                        위치 정확도(m). GPS 정확도 원처럼 쓴다.
                        해당 층 좌표 정합의 leave-one-out 평균이며 기준점 위에서 잰 in-sample 잔차가 아니다.
                        현재 값은 B2 0.497 · B3 1.095.
                        """,
                example = "0.497"
        )
        BigDecimal accuracyM
) {
}
