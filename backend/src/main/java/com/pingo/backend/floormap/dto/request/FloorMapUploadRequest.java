package com.pingo.backend.floormap.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

/**
 * 층별 지도 업로드 요청.
 *
 * <p>좌표 프레임 네 값({@code scaleMPerPx}·{@code originPxX}·{@code originPxY}·{@code frameAngleDeg})은
 * <b>업로드하는 이 이미지 기준</b>이다. 같은 층이라도 다른 이미지로 교체하면 원점 픽셀과 축척이
 * 달라지므로 새 이미지에 맞춰 다시 측정해야 한다.
 *
 * <p>전부 선택 입력이다. 넣지 않으면 지도 표시는 되지만 좌표 오버레이는 동작하지 않는다.
 * {@code originPxX}·{@code originPxY} 는 이미지 좌상단 기준이라 0 이나 음수도 유효하고,
 * {@code frameAngleDeg} 도 음수가 정상이라(역삼역은 -21.28) 양수 제약을 걸지 않는다.
 */
public record FloorMapUploadRequest(
        @NotBlank
        String mapType,

        @Positive
        Integer width,

        @Positive
        Integer height,

        @Positive
        BigDecimal scaleMPerPx,

        BigDecimal originPxX,

        BigDecimal originPxY,

        BigDecimal frameAngleDeg
) {
}
