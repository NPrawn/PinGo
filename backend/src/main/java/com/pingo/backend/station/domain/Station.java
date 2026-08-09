package com.pingo.backend.station.domain;

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
@Table(name = "station")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Station {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "station_id")
    private Long id;

    @Column(name = "name_ko", nullable = false, length = 100)
    private String nameKo;

    @Column(name = "name_en", nullable = false, length = 100)
    private String nameEn;

    @Column(name = "line_info", length = 100)
    private String lineInfo;

    @Column(name = "latitude", precision = 10, scale = 7)
    private BigDecimal latitude;

    @Column(name = "longitude", precision = 10, scale = 7)
    private BigDecimal longitude;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private Station(
            String nameKo,
            String nameEn,
            String lineInfo,
            BigDecimal latitude,
            BigDecimal longitude
    ) {
        this.nameKo = nameKo;
        this.nameEn = nameEn;
        this.lineInfo = lineInfo;
        this.latitude = latitude;
        this.longitude = longitude;
        this.active = true;
    }

    public static Station create(
            String nameKo,
            String nameEn,
            String lineInfo,
            BigDecimal latitude,
            BigDecimal longitude
    ) {
        return new Station(nameKo, nameEn, lineInfo, latitude, longitude);
    }

    public void update(
            String nameKo,
            String nameEn,
            String lineInfo,
            BigDecimal latitude,
            BigDecimal longitude
    ) {
        this.nameKo = nameKo;
        this.nameEn = nameEn;
        this.lineInfo = lineInfo;
        this.latitude = latitude;
        this.longitude = longitude;
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