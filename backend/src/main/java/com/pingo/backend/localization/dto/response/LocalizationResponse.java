package com.pingo.backend.localization.dto.response;

import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public record LocalizationResponse(
        @Schema(description = "위치추정 요청 추적 ID", example = "loc_01JABC")
        String requestId,

        @Schema(
                description = "위치 인식 결과 상태",
                example = "low_confidence",
                allowableValues = {
                        "success",
                        "low_confidence",
                        "no_match",
                        "timeout",
                        "ai_server_unavailable",
                        "overloaded",
                        "invalid_image",
                        "invalid_intrinsics",
                        "map_not_ready",
                        "internal_error"
                }
        )
        LocalizationResultStatus resultStatus,

        @Schema(description = "위치추정에 사용된 AI 맵 버전", example = "YS-2026-07-23.1")
        String mapVersion,

        @ArraySchema(
                schema = @Schema(implementation = LocalizationCandidateResponse.class),
                arraySchema = @Schema(description = "위치 인식 후보 목록. 후보가 없으면 빈 배열을 반환한다.")
        )
        List<LocalizationCandidateResponse> candidates,

        @ArraySchema(
                schema = @Schema(
                        description = "사용자에게 제공할 fallback 동작",
                        implementation = LocalizationFallbackOption.class
                ),
                arraySchema = @Schema(description = "위치 인식 실패 또는 낮은 신뢰도 상황에서 제공할 fallback 옵션 목록")
        )
        List<LocalizationFallbackOption> fallbackOptions,

        @Schema(description = "AI 위치추정 처리 시간(ms)", example = "2310")
        Integer processingTimeMs
) {
}
