package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import java.time.LocalDateTime;

public record CounselorConsultationResponse(
        String consultationId,
        Long stationId,
        ProblemType problemType,
        ConsultationStatus status,
        Long currentNodeId,
        String currentLocationLabel,
        String destinationType,
        Long destinationId,
        String destinationLabel,
        LocalDateTime requestedAt
) {
    public static CounselorConsultationResponse from(ConsultationSession session) {
        String currentLocationLabel = session.getCurrentNodeId() == null
                ? null
                : "Node " + session.getCurrentNodeId();
        String destinationLabel = session.getDestinationId() == null
                ? null
                : session.getDestinationType() + " " + session.getDestinationId();
        return new CounselorConsultationResponse(
                session.getConsultationId(),
                session.getStationId(),
                session.getProblemType(),
                session.getStatus(),
                session.getCurrentNodeId(),
                currentLocationLabel,
                session.getDestinationType(),
                session.getDestinationId(),
                destinationLabel,
                session.getRequestedAt()
        );
    }
}
