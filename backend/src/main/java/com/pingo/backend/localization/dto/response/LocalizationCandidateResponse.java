package com.pingo.backend.localization.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;
import java.math.BigDecimal;

public record LocalizationCandidateResponse(
        @Schema(description = "위치 후보 노드 ID", example = "101")
        Long nodeId,

        @Schema(description = "위치 후보가 속한 층 ID", example = "3")
        Long floorId,

        @Schema(description = "사용자에게 표시할 위치 후보 이름", example = "강남역 2호선 개찰구 앞")
        String label,

        @Schema(description = "실내 지도 기준 X 좌표", example = "127.45")
        BigDecimal mapX,

        @Schema(description = "실내 지도 기준 Y 좌표", example = "82.30")
        BigDecimal mapY,

        @Schema(description = "위치 인식 신뢰도 점수", example = "0.72")
        BigDecimal confidenceScore,

        @Schema(description = "위치 인식 신뢰도 라벨", example = "LOW")
        String confidenceLabel
) {

}
