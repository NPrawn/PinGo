package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;

import java.time.LocalDateTime;

public record ConsultationListResponse(
        String consultationId,
        Long stationId,
        ProblemType problemType,
        ConsultationStatus status,
        String currentLocationLabel,
        String destinationLabel,
        LocalDateTime requestedAt
){
    public static ConsultationListResponse from(ConsultationSession session){
        return new ConsultationListResponse(
                session.getConsultationId(),
                session.getStationId(),
                session.getProblemType(),
                session.getStatus(),
                null, // TODO: route_node-facility 연결(linked_node_id) 정리되면 채우기
                null, // TODO: 위와 동일
                session.getRequestedAt()
        );
    }
}