package com.pingo.backend.usersession.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Persistable;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Getter
@Table(name = "user_session")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserSession implements Persistable<String> {

    @Id
    @Column(name = "user_session_id")
    private String userSessionId;

    @Column(nullable = false, length = 10)
    @Enumerated(EnumType.STRING)
    private Language language;

    private Long selectedStationId;

    private Long currentNodeId;

    @Column(length = 50)
    private String destinationType;

    private Long destinationId;

    @Column(precision = 10, scale = 7)
    private BigDecimal lastGpsLatitude;

    @Column(precision = 10, scale = 7)
    private BigDecimal lastGpsLongitude;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime lastActiveAt;

    private LocalDateTime expiresAt;

    private static final Duration SESSION_TTL = Duration.ofHours(6);

    public static UserSession create(Language language){
        UserSession session = new UserSession();
        session.userSessionId = generateId();
        session.language = language;
        return session;
    }

    private static String generateId(){
        return "usr_" + UUID.randomUUID().toString().replace("-","");
    }

    @PrePersist
    private void prePersist(){
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.lastActiveAt = now;
        this.expiresAt = now.plus(SESSION_TTL);
    }

    public void changeLanguage(Language language){
        this.language = language;
    }

    public void changeSelectedStation(Long selectedStationId){
        this.selectedStationId = selectedStationId;
    }

    public void changeCurrentNode(Long currentNodeId){
        this.currentNodeId = currentNodeId;
    }

    public void changeDestination(String destinationType, Long destinationId){
        this.destinationType = destinationType;
        this.destinationId = destinationId;
    }

    public void updateGpsLocation(BigDecimal latitude, BigDecimal longitude){
        this.lastGpsLatitude = latitude;
        this.lastGpsLongitude = longitude;
    }

    public void recordActivity(){
        this.lastActiveAt = LocalDateTime.now();
    }

    public boolean isExpired() {
        return expiresAt != null && !expiresAt.isAfter(LocalDateTime.now());
    }

    public void expireNow() {
        this.expiresAt = LocalDateTime.now();
    }

    @Override
    public String getId() {
        return userSessionId;
    }

    @Override
    @Transient
    public boolean isNew() {
        return createdAt == null;
    }
}
