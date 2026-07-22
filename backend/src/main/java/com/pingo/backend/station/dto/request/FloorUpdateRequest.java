package com.pingo.backend.station.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FloorUpdateRequest(
        @NotBlank
        @Size(max = 20)
        String floorCode,

        @Size(max = 100)
        String floorName,

        @NotNull
        Integer floorOrder
) {
}
