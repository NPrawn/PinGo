package com.pingo.backend.localization.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

/** 여러 프레임의 가중 투표에 사용할 수 있는, 아직 확정되지 않은 위치 후보다. */
public record LocalizationCandidateResponse(
        @Schema(description = "지도 좌표로 변환된 약한 위치 후보")
        LocalizedPositionResponse position,

        @Schema(description = "후보 위치에서 경로에 진입할 노드 ID", example = "123")
        Long startNodeId,

        @Schema(description = "후보 경로 진입 노드 표시 이름", nullable = true)
        String startNodeLabel,

        @Schema(description = "후보 경로 진입 노드 영문 표시 이름", nullable = true)
        String startNodeLabelEn,

        @Schema(
                description = "다중 프레임 투표 가중치. 강한 단일 프레임 기준을 1로 정규화한다.",
                example = "0.72",
                minimum = "0",
                maximum = "1"
        )
        double confidenceScore
) {
}
