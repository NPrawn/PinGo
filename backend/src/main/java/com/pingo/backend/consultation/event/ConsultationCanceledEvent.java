package com.pingo.backend.consultation.event;

public record ConsultationCanceledEvent(
        String consultationId,
        String signalingRoomId
) {
}
