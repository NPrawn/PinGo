package com.pingo.backend.place.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "place_exit_recommendation")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PlaceExitRecommendation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "recommendation_id")
    private Long id;

    @Column(name = "place_id", nullable = false)
    private Long placeId;

    @Column(name = "exit_facility_id", nullable = false)
    private Long exitFacilityId;

    @Column(name = "priority", nullable = false)
    private int priority;

    @Column(name = "reason_ko", length = 255)
    private String reasonKo;

    @Column(name = "reason_en", length = 255)
    private String reasonEn;

    @Column(name = "walking_time_min")
    private Integer walkingTimeMin;

    @Column(name = "is_primary", nullable = false)
    private boolean primary;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private PlaceExitRecommendation(
            Long placeId,
            Long exitFacilityId,
            int priority,
            String reasonKo,
            String reasonEn,
            Integer walkingTimeMin,
            boolean primary
    ) {
        this.placeId = placeId;
        this.exitFacilityId = exitFacilityId;
        this.priority = priority;
        this.reasonKo = reasonKo;
        this.reasonEn = reasonEn;
        this.walkingTimeMin = walkingTimeMin;
        this.primary = primary;
    }

    public static PlaceExitRecommendation create(
            Long placeId,
            Long exitFacilityId,
            int priority,
            String reasonKo,
            String reasonEn,
            Integer walkingTimeMin,
            boolean primary
    ) {
        return new PlaceExitRecommendation(placeId, exitFacilityId, priority, reasonKo, reasonEn, walkingTimeMin, primary);
    }

    @PrePersist
    private void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    private void preUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
