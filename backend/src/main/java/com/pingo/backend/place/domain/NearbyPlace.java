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

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Entity
@Table(name = "nearby_place")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class NearbyPlace {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "place_id")
    private Long id;

    @Column(name = "station_id", nullable = false)
    private Long stationId;

    @Column(name = "name_ko", nullable = false, length = 100)
    private String nameKo;

    @Column(name = "name_en", length = 100)
    private String nameEn;

    @Column(name = "category", nullable = false, length = 50)
    private String category;

    @Column(name = "address", length = 255)
    private String address;

    @Column(name = "latitude", precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(name = "external_map_url", length = 500)
    private String externalMapUrl;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private NearbyPlace(
            Long stationId,
            String nameKo,
            String nameEn,
            String category,
            String address,
            BigDecimal latitude,
            BigDecimal longitude,
            String externalMapUrl
    ) {
        this.stationId = stationId;
        this.nameKo = nameKo;
        this.nameEn = nameEn;
        this.category = category;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.externalMapUrl = externalMapUrl;
        this.active = true;
    }

    public static NearbyPlace create(
            Long stationId,
            String nameKo,
            String nameEn,
            String category,
            String address,
            BigDecimal latitude,
            BigDecimal longitude,
            String externalMapUrl
    ) {
        return new NearbyPlace(stationId, nameKo, nameEn, category, address, latitude, longitude, externalMapUrl);
    }

    public void update(
            String nameKo,
            String nameEn,
            String category,
            String address,
            BigDecimal latitude,
            BigDecimal longitude,
            String externalMapUrl
    ) {
        this.nameKo = nameKo;
        this.nameEn = nameEn;
        this.category = category;
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.externalMapUrl = externalMapUrl;
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
