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

        @Schema(
                description = """
                        확정한 실내 위치. 캐노니컬 미터 좌표이며 지도에 점으로 찍는다.
                        위치를 확정하지 못했거나 해당 층의 좌표 정합이 없으면 null 이다.
                        """,
                nullable = true
        )
        LocalizedPositionResponse position,

        @Schema(
                description = """
                        경로 탐색을 시작할 노드 ID. position 에서 가장 가까운 노드이며
                        POST /api/routes/indoor 의 startNodeId 로 그대로 넣으면 된다.
                        위치를 확정하지 못하면 null 이다.
                        """,
                example = "123",
                nullable = true
        )
        Long startNodeId,

        @Schema(
                description = "경로 시작 노드의 사용자용 한글 표시 이름.",
                example = "B2 · 대합실",
                nullable = true
        )
        String startNodeLabel,

        @Schema(
                description = "경로 시작 노드의 영문 표시 이름.",
                example = "B2 · Concourse",
                nullable = true
        )
        String startNodeLabelEn,

        @Schema(
                description = "낮은 신뢰도 응답에서만 제공하는 다중 프레임 투표용 위치 후보",
                nullable = true
        )
        LocalizationCandidateResponse candidate,

        @Schema(
                description = "AI 기하 품질 지표를 0~1로 정규화한 위치 인식 신뢰도",
                example = "0.87",
                minimum = "0",
                maximum = "1",
                nullable = true
        )
        Double confidenceScore,

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
