package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;

public record ConsultationCancelResponse(
        String consultationId,
        ConsultationStatus status
) {
    public static ConsultationCancelResponse from(ConsultationSession session){
        return new ConsultationCancelResponse(
                session.getConsultationId(),
                session.getStatus()
        );
    }
}
