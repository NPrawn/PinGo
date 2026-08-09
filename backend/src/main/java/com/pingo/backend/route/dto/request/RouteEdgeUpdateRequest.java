package com.pingo.backend.route.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record RouteEdgeUpdateRequest(
        @NotNull
        @Positive
        BigDecimal distanceM,

        @Positive
        Integer estimatedTimeSec,

        @NotBlank
        @Size(max = 50)
        String moveType,

        Boolean isAccessible,

        Boolean isBidirectional
) {
}
