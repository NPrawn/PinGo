package com.pingo.backend.consultation.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
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
        session.requestedAt = nowUtc();
        return session;
    }

    private static String generateId() {
        return "cs_" + UUID.randomUUID().toString().replace("-", "");
    }

    /**
     * 상담 시각은 언제나 UTC 벽시계로 적는다.
     *
     * `LocalDateTime.now()` 는 JVM 기본 시간대를 따른다. 서버는 UTC 로, 개발 기기는 KST 로
     * 도는 탓에 같은 컬럼에 서로 다른 시간대의 값이 섞여 들어갔다. 어느 쪽으로 읽어야 할지
     * 값만 봐서는 알 수 없다. 나머지 시각 처리도 `Clock.systemUTC()` 를 쓰므로 여기에 맞춘다.
     */
    private static LocalDateTime nowUtc() {
        return LocalDateTime.now(ZoneOffset.UTC);
    }

    /**
     * 저장된 UTC 벽시계를 시간대가 붙은 시점으로 바꾼다.
     *
     * 화면으로 나갈 때는 반드시 이 값을 쓴다. 시간대 없는 문자열(`2026-08-03T04:18:00`)을
     * 그대로 내보내면 브라우저가 자기 시간대로 읽어 버린다. KST 브라우저에서는 9시간 어긋난
     * 시각이 되어, 방금 들어온 요청이 "9시간 6분 기다리는 중"으로 보였다.
     */
    public static Instant toInstant(LocalDateTime utcWallClock) {
        return utcWallClock == null ? null : utcWallClock.toInstant(ZoneOffset.UTC);
    }

    public void cancel(){
        this.status = ConsultationStatus.CANCELED;
    }

    public void accept(Long counselorId){
        this.status = ConsultationStatus.ACCEPTED;
        this.counselorId = counselorId;
        this.acceptedAt = nowUtc();
    }

    public void reject(){
        this.status = ConsultationStatus.REJECTED;
    }

    public void end(){
        this.status = ConsultationStatus.ENDED;
        this.endedAt = nowUtc();
    }

    public String getSignalingRoomId(){
        boolean roomActive = status == ConsultationStatus.ACCEPTED
                || status == ConsultationStatus.IN_PROGRESS;
        return roomActive ? "room_" + consultationId : null;
    }

    public void rate(int score) {
        this.ratingScore = score;
        this.ratedAt = nowUtc();
    }

    public boolean isRated() {
        return this.ratingScore != null;
    }

    public Integer getRatingScore() { return ratingScore; }
    public LocalDateTime getRatedAt() { return ratedAt; }

}
