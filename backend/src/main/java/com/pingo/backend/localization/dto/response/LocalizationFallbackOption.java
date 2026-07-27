package com.pingo.backend.localization.dto.response;

import com.fasterxml.jackson.annotation.JsonValue;

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
