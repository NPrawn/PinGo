package com.pingo.backend.floormap.domain;

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
@Table(name = "floor_map")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FloorMap {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "map_id")
    private Long id;

    @Column(name = "floor_id", nullable = false)
    private Long floorId;

    @Column(name = "map_type", nullable = false, length = 50)
    private String mapType;

    @Column(name = "map_url", nullable = false, length = 500)
    private String mapUrl;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "scale_m_per_px", precision = 10, scale = 6)
    private BigDecimal scaleMPerPx;

    @Column(name = "version", length = 100)
    private String version;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private FloorMap(
            Long floorId,
            String mapType,
            String mapUrl,
            Integer width,
            Integer height,
            BigDecimal scaleMPerPx,
            String version
    ) {
        this.floorId = floorId;
        this.mapType = mapType;
        this.mapUrl = mapUrl;
        this.width = width;
        this.height = height;
        this.scaleMPerPx = scaleMPerPx;
        this.version = version;
        this.active = true;
    }

    public static FloorMap create(
            Long floorId,
            String mapType,
            String mapUrl,
            Integer width,
            Integer height,
            BigDecimal scaleMPerPx,
            String version
    ) {
        return new FloorMap(floorId, mapType, mapUrl, width, height, scaleMPerPx, version);
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
