package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;

public record ConsultationResponse (
        String consultationId,
        ConsultationStatus status,
        Long counselorId,
        String signalingRoomId
){
    public static ConsultationResponse from(ConsultationSession session){
        boolean signalingReady = session.getStatus() == ConsultationStatus.ACCEPTED
                || session.getStatus() == ConsultationStatus.IN_PROGRESS;
        String signalingRoomId = signalingReady ? "room_" + session.getConsultationId() : null;

        return new ConsultationResponse(
                session.getConsultationId(),
                session.getStatus(),
                session.getCounselorId(),
                signalingRoomId
        );
    }
}
