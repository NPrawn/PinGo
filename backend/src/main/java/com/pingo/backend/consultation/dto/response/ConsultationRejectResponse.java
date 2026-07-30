package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;

public record ConsultationRejectResponse(
        String consultationId,
        ConsultationStatus status
) {
    public static ConsultationRejectResponse from(ConsultationSession session) {
        return new ConsultationRejectResponse(
                session.getConsultationId(),
                session.getStatus()
        );
    }
}