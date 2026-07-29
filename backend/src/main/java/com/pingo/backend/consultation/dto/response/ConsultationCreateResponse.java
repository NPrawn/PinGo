package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;

import java.time.LocalDateTime;

public record ConsultationCreateResponse (
        String consultationId,
        ConsultationStatus status,
        LocalDateTime requestedAt
){
    public static ConsultationCreateResponse from(ConsultationSession session){
        return new ConsultationCreateResponse(
                session.getConsultationId(),
                session.getStatus(),
                session.getRequestedAt()
        );
    }
}
