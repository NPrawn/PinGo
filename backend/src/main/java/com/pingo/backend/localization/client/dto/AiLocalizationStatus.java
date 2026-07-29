package com.pingo.backend.localization.client.dto;

public enum AiLocalizationStatus {
    LOCALIZED,
    INVALID_IMAGE,
    INVALID_INTRINSICS,
    MAP_NOT_LOADED,
    NO_RETRIEVAL_CANDIDATE,
    INSUFFICIENT_MATCHES,
    POSE_ESTIMATION_FAILED,
    LOW_GEOMETRIC_QUALITY,
    OVERLOADED,
    INTERNAL_ERROR
}
