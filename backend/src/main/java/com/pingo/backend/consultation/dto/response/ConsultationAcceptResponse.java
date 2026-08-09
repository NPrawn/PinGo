package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;

public record ConsultationAcceptResponse(
        String consultationId,
        ConsultationStatus status,
        Long counselorId,
        String signalingRoomId,
        String signalingAccessToken
) {
    public static ConsultationAcceptResponse from(ConsultationSession session, String signalingAccessToken) {
        return new ConsultationAcceptResponse(
                session.getConsultationId(),
                session.getStatus(),
                session.getCounselorId(),
                session.getSignalingRoomId(),
                signalingAccessToken
        );
    }
}
