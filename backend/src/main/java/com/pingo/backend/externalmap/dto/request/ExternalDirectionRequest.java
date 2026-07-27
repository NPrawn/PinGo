package com.pingo.backend.externalmap.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ExternalDirectionRequest(
        @NotBlank
        String provider,

        @NotNull
        @Valid
        GeoPointRequest origin,

        @NotNull
        @Valid
        ExternalDestinationRequest destination,

        @NotBlank
        String mode
) {

}
