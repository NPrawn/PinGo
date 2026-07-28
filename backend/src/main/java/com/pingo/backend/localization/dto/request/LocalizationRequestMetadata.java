package com.pingo.backend.localization.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record LocalizationRequestMetadata(
        @Schema(description = "비로그인 사용자 세션 ID", example = "usr_sess_01JABC")
        @NotBlank
        String userSessionId,

        @Schema(description = "역 ID", example = "1")
        @NotNull
        Long stationId,

        @Schema(description = "AI 맵 버전", example = "YS-2026-07-23.1")
        @NotBlank
        String mapVersion,

        @Schema(description = "단말 방위각", example = "126.8")
        Double heading,

        @Schema(description = "촬영 시각", example = "2026-07-23T08:10:11.123Z")
        Instant capturedAt,

        @Schema(description = "카메라 메타데이터")
        @Valid
        CameraMetadataRequest camera
) {

}
