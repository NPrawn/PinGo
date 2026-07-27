package com.pingo.backend.externalmap.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ExternalDirectionRequest(
        @Schema(
                description = "외부 지도 제공자. 현재 kakao만 지원한다.",
                example = "kakao",
                allowableValues = "kakao",
                requiredMode = Schema.RequiredMode.REQUIRED
        )
        @NotBlank
        String provider,

        @Schema(description = "출발지 좌표", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull
        @Valid
        GeoPointRequest origin,

        @Schema(description = "목적지 정보", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull
        @Valid
        ExternalDestinationRequest destination,

        @Schema(
                description = "길찾기 이동 수단. 현재 foot만 지원한다.",
                example = "foot",
                allowableValues = "foot",
                requiredMode = Schema.RequiredMode.REQUIRED
        )
        @NotBlank
        String mode
) {

}
