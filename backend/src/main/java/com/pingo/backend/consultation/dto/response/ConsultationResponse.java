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
        String signalingRoomId = session.getStatus() == ConsultationStatus.WAITING
                ? null
                : "room_" + session.getConsultationId();

        return new ConsultationResponse(
                session.getConsultationId(),
                session.getStatus(),
                session.getCounselorId(),
                signalingRoomId
        );
    }
}
