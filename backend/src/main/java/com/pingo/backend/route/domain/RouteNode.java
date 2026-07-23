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
@Table(name = "route_node")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RouteNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "node_id")
    private Long id;

    @Column(name = "station_id", nullable = false)
    private Long stationId;

    @Column(name = "floor_id", nullable = false)
    private Long floorId;

    @Column(name = "node_type", nullable = false, length = 50)
    private String nodeType;

    @Column(name = "name", length = 100)
    private String name;

    @Column(name = "map_x", nullable = false, precision = 10, scale = 3)
    private BigDecimal mapX;

    @Column(name = "map_y", nullable = false, precision = 10, scale = 3)
    private BigDecimal mapY;

    @Column(name = "is_landmark", nullable = false)
    private boolean landmark;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private RouteNode(
            Long stationId,
            Long floorId,
            String nodeType,
            String name,
            BigDecimal mapX,
            BigDecimal mapY,
            boolean landmark
    ) {
        this.stationId = stationId;
        this.floorId = floorId;
        this.nodeType = nodeType;
        this.name = name;
        this.mapX = mapX;
        this.mapY = mapY;
        this.landmark = landmark;
    }

    public static RouteNode create(
            Long stationId,
            Long floorId,
            String nodeType,
            String name,
            BigDecimal mapX,
            BigDecimal mapY,
            boolean landmark
    ) {
        return new RouteNode(stationId, floorId, nodeType, name, mapX, mapY, landmark);
    }

    public void update(String nodeType, String name, BigDecimal mapX, BigDecimal mapY, boolean landmark) {
        this.nodeType = nodeType;
        this.name = name;
        this.mapX = mapX;
        this.mapY = mapY;
        this.landmark = landmark;
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
