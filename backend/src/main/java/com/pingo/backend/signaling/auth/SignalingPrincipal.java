package com.pingo.backend.signaling.auth;

import com.pingo.backend.signaling.dto.SignalingSenderType;

public record SignalingPrincipal(
        String consultationId,
        SignalingSenderType senderType,
        String userSessionId,
        Long accountId
) {
}
