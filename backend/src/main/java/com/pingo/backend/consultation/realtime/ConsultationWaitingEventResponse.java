package com.pingo.backend.consultation.realtime;

import java.time.Instant;

public record ConsultationWaitingEventResponse(
        String consultationRequestId,
        ConsultationWaitingEventType type,
        String signalingRoomId,
        String message,
        Instant timestamp
) {

}
