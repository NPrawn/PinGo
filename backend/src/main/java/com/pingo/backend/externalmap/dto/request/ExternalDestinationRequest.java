package com.pingo.backend.externalmap.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record ExternalDestinationRequest(
        Long placeId,

        @NotBlank
        @Size(max = 100)
        String name,

        @DecimalMin("-90.0")
        @DecimalMax("90.0")
        BigDecimal latitude,

        @DecimalMin("-180.0")
        @DecimalMax("180.0")
        BigDecimal longitude,

        @Size(max = 100)
        String address
) {
}
