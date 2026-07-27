package com.pingo.backend.usersession.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Getter
@Table(name = "user_session")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserSession {

    @Id
    @Column(name = "user_session_id")
    private String userSessionId;

    @Column(nullable = false, length = 10)
    private String language;

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

    public static UserSession create(String language){
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
    }
}
