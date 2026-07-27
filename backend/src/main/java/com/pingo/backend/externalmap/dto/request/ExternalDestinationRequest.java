package com.pingo.backend.externalmap.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record ExternalDestinationRequest(
        @Schema(description = "목적지 장소 ID", example = "1")
        Long placeId,

        @Schema(description = "목적지 이름", example = "강남역", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotBlank
        @Size(max = 100)
        String name,

        @Schema(description = "목적지 위도", example = "37.4979", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull
        @DecimalMin("-90.0")
        @DecimalMax("90.0")
        BigDecimal latitude,

        @Schema(description = "목적지 경도", example = "127.0276", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull
        @DecimalMin("-180.0")
        @DecimalMax("180.0")
        BigDecimal longitude,

        @Schema(description = "목적지 주소", example = "서울특별시 강남구 강남대로 지하396")
        @Size(max = 100)
        String address
) {
}
