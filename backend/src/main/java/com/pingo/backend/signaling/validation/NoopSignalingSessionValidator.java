package com.pingo.backend.signaling.validation;

import com.pingo.backend.signaling.dto.SignalingSenderType;
import org.springframework.stereotype.Component;

@Component
public class NoopSignalingSessionValidator implements SignalingSessionValidator {

    @Override
    public SignalingSessionValidationResult validateJoin(
            String signalingSessionId,
            SignalingSenderType senderType
    ) {
        return SignalingSessionValidationResult.VALID;
    }

}
