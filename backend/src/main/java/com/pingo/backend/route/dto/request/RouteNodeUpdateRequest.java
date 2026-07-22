package com.pingo.backend.route.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record RouteNodeUpdateRequest(
        @NotBlank
        @Size(max = 50)
        String nodeType,

        @Size(max = 100)
        String name,

        @NotNull
        BigDecimal mapX,

        @NotNull
        BigDecimal mapY,

        Boolean isLandmark
) {
}
