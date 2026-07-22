package com.pingo.backend.route.domain;

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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "route_edge")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RouteEdge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "edge_id")
    private Long id;

    @Column(name = "station_id", nullable = false)
    private Long stationId;

    @Column(name = "from_node_id", nullable = false)
    private Long fromNodeId;

    @Column(name = "to_node_id", nullable = false)
    private Long toNodeId;

    @Column(name = "distance_m", nullable = false, precision = 10, scale = 2)
    private BigDecimal distanceM;

    @Column(name = "estimated_time_sec")
    private Integer estimatedTimeSec;

    @Column(name = "move_type", nullable = false, length = 50)
    private String moveType;

    @Column(name = "is_accessible", nullable = false)
    private boolean accessible;

    @Column(name = "is_bidirectional", nullable = false)
    private boolean bidirectional;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private RouteEdge(
            Long stationId,
            Long fromNodeId,
            Long toNodeId,
            BigDecimal distanceM,
            Integer estimatedTimeSec,
            String moveType,
            boolean accessible,
            boolean bidirectional
    ) {
        this.stationId = stationId;
        this.fromNodeId = fromNodeId;
        this.toNodeId = toNodeId;
        this.distanceM = distanceM;
        this.estimatedTimeSec = estimatedTimeSec;
        this.moveType = moveType;
        this.accessible = accessible;
        this.bidirectional = bidirectional;
        this.active = true;
    }

    public static RouteEdge create(
            Long stationId,
            Long fromNodeId,
            Long toNodeId,
            BigDecimal distanceM,
            Integer estimatedTimeSec,
            String moveType,
            boolean accessible,
            boolean bidirectional
    ) {
        return new RouteEdge(stationId, fromNodeId, toNodeId, distanceM, estimatedTimeSec, moveType, accessible, bidirectional);
    }

    public void update(
            BigDecimal distanceM,
            Integer estimatedTimeSec,
            String moveType,
            boolean accessible,
            boolean bidirectional
    ) {
        this.distanceM = distanceM;
        this.estimatedTimeSec = estimatedTimeSec;
        this.moveType = moveType;
        this.accessible = accessible;
        this.bidirectional = bidirectional;
    }

    public void deactivate() {
        this.active = false;
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
