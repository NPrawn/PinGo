package com.pingo.backend.consultation.event;

public record ConsultationAcceptedEvent(
        String consultationId,
        String signalingRoomId
) {
}
