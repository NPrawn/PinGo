package com.pingo.backend.consultation.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ConsultationSession {

    @Id
    private String consultationId;

    @Column(nullable = false)
    private String userSessionId;

    @Column(nullable = false)
    private Long stationId;

    private Long counselorId;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ProblemType problemType;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private ConsultationStatus status;

    private Long currentNodeId;

    private String destinationType;

    private Long destinationId;

    @Column(nullable = false)
    private boolean videoConsent;

    @Column(nullable = false)
    private boolean audioConsent;

    @Column(nullable = false, updatable = false)
    private LocalDateTime requestedAt;

    private LocalDateTime acceptedAt;

    private LocalDateTime endedAt;

    public static ConsultationSession create(String userSessionId, Long stationId, ProblemType problemType,
                                             Long currentNodeId, String destinationType, Long destinationId,
                                             boolean videoConsent, boolean audioConsent){
        ConsultationSession session = new ConsultationSession();
        session.consultationId = generateId();
        session.userSessionId = userSessionId;
        session.stationId = stationId;
        session.problemType = problemType;
        session.status = ConsultationStatus.WAITING;
        session.currentNodeId = currentNodeId;
        session.destinationType = destinationType;
        session.destinationId = destinationId;
        session.videoConsent = videoConsent;
        session.audioConsent = audioConsent;
        session.requestedAt = LocalDateTime.now();
        return session;
    }

    private static String generateId() {
        return "cs_" + UUID.randomUUID().toString().replace("-", "");
    }

    public void cancel(){
        this.status = ConsultationStatus.CANCELED;
    }
}
