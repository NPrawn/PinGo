package com.pingo.backend.localization.dto.response;

import com.fasterxml.jackson.annotation.JsonValue;
import io.swagger.v3.oas.annotations.media.Schema;

@Schema(
        description = """
                위치 인식 결과 상태.
                success: 위치 인식 성공,
                low_confidence: 후보는 있으나 신뢰도 낮음,
                no_match: 매칭 후보 없음,
                timeout: 위치 인식 시간 초과,
                ai_server_unavailable: AI 서버 사용 불가,
                overloaded: AI 서버 과부하,
                invalid_image: 이미지 품질 또는 형식 오류,
                invalid_intrinsics: 카메라 내부 파라미터 오류,
                map_not_ready: 지도 데이터 준비 안 됨,
                internal_error: 내부 오류
                """,
        allowableValues = {
                "success",
                "low_confidence",
                "no_match",
                "timeout",
                "ai_server_unavailable",
                "overloaded",
                "invalid_image",
                "invalid_intrinsics",
                "map_not_ready",
                "internal_error"
        }
)
public enum LocalizationResultStatus {
    SUCCESS("success"),
    LOW_CONFIDENCE("low_confidence"),
    NO_MATCH("no_match"),
    TIMEOUT("timeout"),
    AI_SERVER_UNAVAILABLE("ai_server_unavailable"),
    OVERLOADED("overloaded"),
    INVALID_IMAGE("invalid_image"),
    INVALID_INTRINSICS("invalid_intrinsics"),
    MAP_NOT_READY("map_not_ready"),
    INTERNAL_ERROR("internal_error");

    private final String code;

    LocalizationResultStatus(String code) {
        this.code = code;
    }

    @JsonValue
    public String getCode() {
        return code;
    }
}
