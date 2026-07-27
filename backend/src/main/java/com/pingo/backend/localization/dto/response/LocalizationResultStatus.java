package com.pingo.backend.localization.dto.response;

import com.fasterxml.jackson.annotation.JsonValue;

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
