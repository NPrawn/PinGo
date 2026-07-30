package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;

import java.time.LocalDateTime;

public record ConsultationDetailResponse(
        String consultationId,
        Long stationId,
        ProblemType problemType,
        ConsultationStatus status,
        String currentLocationLabel,
        String destinationLabel,
        boolean videoConsent,
        boolean audioConsent,
        LocalDateTime requestedAt
){
    public static ConsultationDetailResponse from(ConsultationSession session){
        return new ConsultationDetailResponse(
                session.getConsultationId(),
                session.getStationId(),
                session.getProblemType(),
                session.getStatus(),
                null, // [TODO] OO: 위와 동일
                null, // [TODO] OO: 위와 동일
                session.isVideoConsent(),
                session.isAudioConsent(),
                session.getRequestedAt()
        );
    }
}