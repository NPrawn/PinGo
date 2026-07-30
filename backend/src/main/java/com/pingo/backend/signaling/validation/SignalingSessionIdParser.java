package com.pingo.backend.signaling.validation;

import java.util.Optional;

public class SignalingSessionIdParser {

    private static final String ROOM_PREFIX = "room_";

    public Optional<String> parseConsultationId(String signalingSessionId) {
        if (signalingSessionId == null || !signalingSessionId.startsWith(ROOM_PREFIX)) {
            return Optional.empty();
        }

        String consultationId = signalingSessionId.substring(ROOM_PREFIX.length());
        if (consultationId.isBlank()) {
            return Optional.empty();
        }

        return Optional.of(consultationId);
    }
}
