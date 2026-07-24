package com.pingo.backend.place.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/**
 * 주변 장소 등록 요청. 좌표(위경도)는 실외 GPS·관리자 입력값을 그대로 저장하며 서버에서 계산하지 않는다.
 */
public record NearbyPlaceCreateRequest(
        @NotNull
        Long stationId,

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
