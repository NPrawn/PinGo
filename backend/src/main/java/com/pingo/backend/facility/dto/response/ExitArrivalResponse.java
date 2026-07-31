package com.pingo.backend.facility.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

/**
 * 출구 도착 판정 결과.
 *
 * <p>{@code arrived} 는 <b>같은 층이고 거리가 임계값 이하</b>일 때만 참이다.
 * 층이 다르면 평면 거리와 무관하게 거짓이다.
 *
 * <p>{@code distanceM} 을 함께 주므로 클라이언트가 "출구까지 12m" 같은 안내를 하거나
 * 자체 기준으로 판단할 수도 있다. 층이 다르면 평면 거리는 의미가 없어 null 이다.
 *
 * <p>판정이 자동으로 되지 않을 때 사용자가 직접 도착을 선택하는 흐름(FR-U-011)은
 * 클라이언트가 처리한다. 이 API 는 판단만 제공한다.
 */
public record ExitArrivalResponse(
        @Schema(description = "출구 시설 ID", example = "42")
        Long facilityId,

        @Schema(description = "출구 이름(한국어)", example = "6번 출구")
        String nameKo,

        @Schema(description = "출구 이름(영어)", example = "Exit 6")
        String nameEn,

        @Schema(description = "출구가 속한 층 ID", example = "3")
        Long floorId,

        @Schema(description = "도착 여부", example = "true")
        boolean arrived,

        @Schema(description = "현재 위치와 출구가 같은 층인지", example = "true")
        boolean sameFloor,

        @Schema(description = "출구까지의 평면 거리(m). 층이 다르면 null", example = "4.12")
        BigDecimal distanceM,

        @Schema(description = "도착으로 판정하는 거리 임계값(m)", example = "10.0")
        BigDecimal thresholdM
) {
}
