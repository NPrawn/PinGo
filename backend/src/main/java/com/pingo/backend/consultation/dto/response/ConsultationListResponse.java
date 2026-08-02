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
        Long currentNodeId,
        String currentLocationLabel,
        String destinationType,
        Long destinationId,
        String destinationLabel,
        LocalDateTime requestedAt
){
    public static ConsultationListResponse from(ConsultationSession session){
        // TODO: route_node-facility 연결(linked_node_id)이 정리되면 실제 이름으로 채운다.
        // 그때까지는 상담자 콘솔이 최소한 어느 노드·목적지인지 알 수 있게 식별자를 노출한다.
        String currentLocationLabel = session.getCurrentNodeId() == null
                ? null
                : "Node " + session.getCurrentNodeId();
        String destinationLabel = session.getDestinationId() == null
                ? null
                : session.getDestinationType() + " " + session.getDestinationId();

        return new ConsultationListResponse(
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