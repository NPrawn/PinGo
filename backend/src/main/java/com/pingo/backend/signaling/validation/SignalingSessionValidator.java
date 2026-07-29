package com.pingo.backend.signaling.validation;

import com.pingo.backend.signaling.dto.SignalingSenderType;

public interface SignalingSessionValidator {

    SignalingSessionValidationResult validateJoin(
            String signalingSessionId,
            SignalingSenderType senderType
    );
}
