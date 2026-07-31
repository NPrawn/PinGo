package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;

public record ConsultationSignalingTokenResponse(
        String consultationId,
        ConsultationStatus status,
        String signalingRoomId,
        String signalingAccessToken
) {
    public static ConsultationSignalingTokenResponse from(
            ConsultationSession session,
            String signalingAccessToken
    ) {
        return new ConsultationSignalingTokenResponse(
                session.getConsultationId(),
                session.getStatus(),
                session.getSignalingRoomId(),
                signalingAccessToken
        );
    }
}
