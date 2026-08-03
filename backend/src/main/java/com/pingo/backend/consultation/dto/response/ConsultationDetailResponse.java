package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;

import java.time.Instant;

public record ConsultationDetailResponse(
        String consultationId,
        Long stationId,
        ProblemType problemType,
        ConsultationStatus status,
        String currentLocationLabel,
        String destinationLabel,
        boolean videoConsent,
        boolean audioConsent,
        Instant requestedAt,
        String signalingRoomId,
        String signalingAccessToken
){
    public static ConsultationDetailResponse from(ConsultationSession session, String signalingAccessToken){
        return new ConsultationDetailResponse(
                session.getConsultationId(),
                session.getStationId(),
                session.getProblemType(),
                session.getStatus(),
                null, // [TODO] OO: 위와 동일
                null, // [TODO] OO: 위와 동일
                session.isVideoConsent(),
                session.isAudioConsent(),
                ConsultationSession.toInstant(session.getRequestedAt()),
                session.getSignalingRoomId(),
                signalingAccessToken
        );
    }
}