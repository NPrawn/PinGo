package com.pingo.backend.signaling.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public record SignalingMessage(
        @NotBlank
        String sessionId,

        @NotNull
        SignalingSenderType senderType,

        @NotNull
        SignalingMessageType type,

        JsonNode payload,

        @NotNull
        Instant timestamp
) {
}
