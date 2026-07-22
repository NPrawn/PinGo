package com.pingo.backend.facility.domain;

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
@Table(name = "facility")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Facility {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "facility_id")
    private Long id;

    @Column(name = "station_id", nullable = false)
    private Long stationId;

    @Column(name = "floor_id", nullable = false)
    private Long floorId;

    @Column(name = "facility_type", nullable = false, length = 50)
    private String facilityType;

    @Column(name = "name_ko", nullable = false, length = 100)
    private String nameKo;

    @Column(name = "name_en", length = 100)
    private String nameEn;

    @Column(name = "map_x", nullable = false, precision = 10, scale = 3)
    private BigDecimal mapX;

    @Column(name = "map_y", nullable = false, precision = 10, scale = 3)
    private BigDecimal mapY;

    @Column(name = "linked_node_id")
    private Long linkedNodeId;

    @Column(name = "is_accessible", nullable = false)
    private boolean accessible;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private Facility(
            Long stationId,
            Long floorId,
            String facilityType,
            String nameKo,
            String nameEn,
            BigDecimal mapX,
            BigDecimal mapY,
            Long linkedNodeId,
            boolean accessible
    ) {
        this.stationId = stationId;
        this.floorId = floorId;
        this.facilityType = facilityType;
        this.nameKo = nameKo;
        this.nameEn = nameEn;
        this.mapX = mapX;
        this.mapY = mapY;
        this.linkedNodeId = linkedNodeId;
        this.accessible = accessible;
        this.active = true;
    }

    public static Facility create(
            Long stationId,
            Long floorId,
            String facilityType,
            String nameKo,
            String nameEn,
            BigDecimal mapX,
            BigDecimal mapY,
            Long linkedNodeId,
            boolean accessible
    ) {
        return new Facility(stationId, floorId, facilityType, nameKo, nameEn, mapX, mapY, linkedNodeId, accessible);
    }

    public void update(
            String facilityType,
            String nameKo,
            String nameEn,
            BigDecimal mapX,
            BigDecimal mapY,
            Long linkedNodeId,
            boolean accessible
    ) {
        this.facilityType = facilityType;
        this.nameKo = nameKo;
        this.nameEn = nameEn;
        this.mapX = mapX;
        this.mapY = mapY;
        this.linkedNodeId = linkedNodeId;
        this.accessible = accessible;
    }

    public void deactivate() {
        this.active = false;
    }

    public boolean isExit() {
        return "exit".equals(facilityType);
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
