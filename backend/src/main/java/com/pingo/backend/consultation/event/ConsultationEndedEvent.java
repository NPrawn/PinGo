package com.pingo.backend.consultation.event;

public record ConsultationEndedEvent(
        String consultationId,
        String signalingRoomId
) {
}
