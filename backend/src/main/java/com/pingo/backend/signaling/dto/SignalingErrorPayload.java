package com.pingo.backend.signaling.dto;

public record SignalingErrorPayload(
        String code,
        String message,
        boolean retryable
) {
}
