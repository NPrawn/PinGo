package com.pingo.backend.station.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "station_floor")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class StationFloor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "floor_id")
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "station_id", nullable = false)
    private Station station;

    @Column(name = "floor_code", nullable = false, length = 20)
    private String floorCode;

    @Column(name = "floor_name", length = 100)
    private String floorName;

    @Column(name = "floor_order", nullable = false)
    private int floorOrder;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private StationFloor(
            Station station,
            String floorCode,
            String floorName,
            int floorOrder
    ) {
        this.station = station;
        this.floorCode = floorCode;
        this.floorName = floorName;
        this.floorOrder = floorOrder;
    }

    public static StationFloor create(
            Station station,
            String floorCode,
            String floorName,
            int floorOrder
    ) {
        return new StationFloor(station, floorCode, floorName, floorOrder);
    }

    public void update(String floorCode, String floorName, int floorOrder) {
        this.floorCode = floorCode;
        this.floorName = floorName;
        this.floorOrder = floorOrder;
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
