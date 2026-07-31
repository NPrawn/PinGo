package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;

public record ConsultationEndResponse(
        String consultationId,
        ConsultationStatus status

) {
    public static ConsultationEndResponse from(ConsultationSession session) {
        return new ConsultationEndResponse(
                session.getConsultationId(),
                session.getStatus()
        );
    }
}
