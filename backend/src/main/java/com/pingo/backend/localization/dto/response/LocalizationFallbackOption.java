package com.pingo.backend.localization.dto.response;

import com.fasterxml.jackson.annotation.JsonValue;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        description = """
                위치 인식 실패 시 사용자에게 제공할 fallback 동작.
                retry_capture: 다시 촬영,
                select_landmark: 랜드마크 선택,
                select_on_map: 지도에서 직접 선택,
                request_consultation: 상담 요청
                """,
        allowableValues = {
                "retry_capture",
                "select_landmark",
                "select_on_map",
                "request_consultation"
        }
)
public enum LocalizationFallbackOption {
    RETRY_CAPTURE("retry_capture"),
    SELECT_LANDMARK("select_landmark"),
    SELECT_ON_MAP("select_on_map"),
    REQUEST_CONSULTATION("request_consultation");

    private final String code;

    LocalizationFallbackOption(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }
}
