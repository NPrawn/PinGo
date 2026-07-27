package com.pingo.backend.localization.dto.response;

public enum LocalizationResultStatus {
    SUCCESS,
    LOW_CONFIDENCE,
    NO_MATCH,
    TIMEOUT,
    AI_SERVER_UNAVAILABLE,
    OVERLOADED,
    INVALID_IMAGE,
    INVALID_INTRINSICS,
    MAP_NOT_READY,
    INTERNAL_ERROR
}
