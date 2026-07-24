package com.pingo.backend.place.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * 주변 장소 수정 요청. 소속 역(stationId)은 변경 대상이 아니므로 포함하지 않는다.
 */
public record NearbyPlaceUpdateRequest(
        @NotBlank
        @Size(max = 100)
        String nameKo,

        @Size(max = 100)
        String nameEn,

        @NotBlank
        @Size(max = 50)
        String category,

        @Size(max = 255)
        String address,

        @DecimalMin("-90.0")
        @DecimalMax("90.0")
        BigDecimal latitude,

        @DecimalMin("-180.0")
        @DecimalMax("180.0")
        BigDecimal longitude,

        @Size(max = 500)
        String externalMapUrl
) {
}
