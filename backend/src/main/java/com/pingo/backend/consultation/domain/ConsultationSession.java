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

    @Column(nullable = false)
    private boolean locationConsent;

    @Column(nullable = false, updatable = false)
    private LocalDateTime requestedAt;

    private LocalDateTime acceptedAt;

    private LocalDateTime endedAt;

    @Column(columnDefinition = "TINYINT")
    private Integer ratingScore;

    private LocalDateTime ratedAt;

    public static ConsultationSession create(String userSessionId, Long stationId, ProblemType problemType,
                                             Long currentNodeId, String destinationType, Long destinationId,
                                             boolean videoConsent, boolean audioConsent, boolean locationConsent){
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
        session.locationConsent = locationConsent;
        session.requestedAt = LocalDateTime.now();
        return session;
    }

    private static String generateId() {
        return "cs_" + UUID.randomUUID().toString().replace("-", "");
    }

    public void cancel(){
        this.status = ConsultationStatus.CANCELED;
    }

    public void accept(Long counselorId){
        this.status = ConsultationStatus.ACCEPTED;
        this.counselorId = counselorId;
        this.acceptedAt = LocalDateTime.now();
    }

    public void reject(){
        this.status = ConsultationStatus.REJECTED;
    }

    public void end(){
        this.status = ConsultationStatus.ENDED;
        this.endedAt = LocalDateTime.now();
    }

    public String getSignalingRoomId(){
        boolean roomActive = status == ConsultationStatus.ACCEPTED
                || status == ConsultationStatus.IN_PROGRESS;
        return roomActive ? "room_" + consultationId : null;
    }

    public void rate(int score) {
        this.ratingScore = score;
        this.ratedAt = LocalDateTime.now();
    }

    public boolean isRated() {
        return this.ratingScore != null;
    }

    public Integer getRatingScore() { return ratingScore; }
    public LocalDateTime getRatedAt() { return ratedAt; }

}
