package com.pingo.backend.facility.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record ExitDetailRequest(
        @NotBlank
        @Size(max = 20)
        String exitNumber,

        @DecimalMin(value = "-90.0")
        @DecimalMax(value = "90.0")
        BigDecimal outsideLatitude,

        @DecimalMin(value = "-180.0")
        @DecimalMax(value = "180.0")
        BigDecimal outsideLongitude,

        String descriptionKo,

        String descriptionEn
) {
}
