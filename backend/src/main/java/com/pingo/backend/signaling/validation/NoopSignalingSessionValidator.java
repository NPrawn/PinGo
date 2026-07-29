package com.pingo.backend.signaling.validation;

import com.pingo.backend.signaling.dto.SignalingSenderType;

public class NoopSignalingSessionValidator implements SignalingSessionValidator {

    @Override
    public SignalingSessionValidationResult validateJoin(
            String signalingSessionId,
            SignalingSenderType senderType
    ) {
        return SignalingSessionValidationResult.VALID;
    }
}
