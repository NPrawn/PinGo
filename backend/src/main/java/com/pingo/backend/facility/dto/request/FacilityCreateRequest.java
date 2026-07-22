package com.pingo.backend.facility.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record FacilityCreateRequest(
        @NotNull
        Long stationId,

        @NotNull
        Long floorId,

        @NotBlank
        @Size(max = 50)
        String facilityType,

        @NotBlank
        @Size(max = 100)
        String nameKo,

        @Size(max = 100)
        String nameEn,

        @NotNull
        BigDecimal mapX,

        @NotNull
        BigDecimal mapY,

        Long linkedNodeId,

        Boolean isAccessible,

        @Valid
        ExitDetailRequest exitDetail
) {
}
