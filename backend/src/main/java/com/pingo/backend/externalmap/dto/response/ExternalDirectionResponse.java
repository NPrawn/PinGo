package com.pingo.backend.externalmap.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

public record ExternalDirectionResponse(
        @Schema(description = "외부 지도 제공자", example = "kakao")
        String provider,

        @Schema(
                description = "카카오맵 앱 딥링크 URL",
                example = "kakaomap://route?sp=37.5665,126.9780&ep=37.4979,127.0276&by=foot"
        )
        String appUrl,

        @Schema(
                description = "카카오맵 웹 길찾기 URL",
                example = "https://map.kakao.com/link/by/walk/현재 위치,37.5665,126.9780/강남역,37.4979,127.0276"
        )
        String webUrl,

        @Schema(description = "도보 경로 거리(m)", example = "2450")
        Long distanceM,

        @Schema(description = "도보 예상 시간(초)", example = "2295")
        Long estimatedTimeSec
) {

}
