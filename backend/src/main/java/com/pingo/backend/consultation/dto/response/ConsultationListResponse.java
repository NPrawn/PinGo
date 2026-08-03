package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;

import java.time.Instant;

public record ConsultationListResponse(
        String consultationId,
        Long stationId,
        ProblemType problemType,
        ConsultationStatus status,
        /**
         * 이 상담을 맡은 상담자. 아직 수락 전이면 null 이다.
         *
         * 목록은 담당 역의 상담을 모두 담기 때문에, 남이 맡은 상담도 함께 온다. 이 값이
         * 없으면 콘솔은 그것을 구분하지 못해 아무 상담이나 들어가게 두었고, 서버는 종료를
         * 403(담당 상담자가 아님)으로 거절했다. 상담자에게는 "종료가 안 되는" 것으로만 보였다.
         */
        Long counselorId,
        Long currentNodeId,
        String currentLocationLabel,
        String destinationType,
        Long destinationId,
        String destinationLabel,
        Instant requestedAt
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
                session.getCounselorId(),
                session.getCurrentNodeId(),
                currentLocationLabel,
                session.getDestinationType(),
                session.getDestinationId(),
                destinationLabel,
                ConsultationSession.toInstant(session.getRequestedAt())
        );
    }
}