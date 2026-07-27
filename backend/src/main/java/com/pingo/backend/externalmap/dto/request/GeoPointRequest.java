package com.pingo.backend.externalmap.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record GeoPointRequest(
        @Schema(description = "위도", example = "37.5665", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull
        @DecimalMin("-90.0")
        @DecimalMax("90.0")
        BigDecimal latitude,

        @Schema(description = "경도", example = "126.9780", requiredMode = Schema.RequiredMode.REQUIRED)
        @NotNull
        @DecimalMin("-180.0")
        @DecimalMax("180.0")
        BigDecimal longitude
) {

}
