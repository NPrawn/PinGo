package com.pingo.backend.facility.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * 출구 도착 판정 요청. 사용자의 현재 실내 위치를 캐노니컬 미터 좌표로 보낸다.
 *
 * <p>좌표는 WebXR 상대 추적 결과나 위치 인식(VPS) 결과에서 온다. 층은 좌표로 유도하지 않고
 * 현재 확정된 층을 그대로 보낸다.
 *
 * <p>높이(z)는 받지 않는다. 판정이 같은 층 안의 평면 거리로 이루어지고, 클라이언트가
 * 높이를 추적하지 않기 때문이다.
 */
public record ExitArrivalCheckRequest(
        @NotNull
        @Schema(description = "현재 층 ID", example = "3")
        Long floorId,

        @NotNull
        @Schema(description = "현재 위치 X (캐노니컬 미터)", example = "100.354")
        BigDecimal mapX,

        @NotNull
        @Schema(description = "현재 위치 Y (캐노니컬 미터)", example = "-39.875")
        BigDecimal mapY
) {
}
