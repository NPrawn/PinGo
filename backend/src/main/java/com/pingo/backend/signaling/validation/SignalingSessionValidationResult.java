package com.pingo.backend.signaling.validation;

public enum SignalingSessionValidationResult {
    VALID,
    SESSION_NOT_FOUND,
    SESSION_NOT_ACCEPTED,
    SESSION_CLOSED,
    UNAUTHORIZED_PARTICIPANT
}
