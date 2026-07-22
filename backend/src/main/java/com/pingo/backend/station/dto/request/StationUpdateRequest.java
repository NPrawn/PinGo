package com.pingo.backend.station.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record StationUpdateRequest(
        @NotBlank
        @Size(max = 100)
        String nameKo,

        @NotBlank
        @Size(max = 100)
        String nameEn,

        @Size(max = 100)
        String lineInfo,

        @DecimalMin(value = "-90.0")
        @DecimalMax(value = "90.0")
        BigDecimal latitude,

        @DecimalMin(value = "-180.0")
        @DecimalMax(value = "180.0")
        BigDecimal longitude
) {
}
