package com.pingo.backend.floormap.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record FloorMapUploadRequest(
        @NotBlank
        String mapType,

        @Positive
        Integer width,

        @Positive
        Integer height,

        @Positive
        BigDecimal scaleMPerPx
) {
}
