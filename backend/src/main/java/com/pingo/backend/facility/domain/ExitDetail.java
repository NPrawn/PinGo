package com.pingo.backend.facility.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Getter
@Entity
@Table(name = "exit_detail")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExitDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "exit_id")
    private Long id;

    @Column(name = "facility_id", nullable = false, unique = true)
    private Long facilityId;

    @Column(name = "exit_number", nullable = false, length = 20)
    private String exitNumber;

    @Column(name = "outside_latitude", precision = 10, scale = 7)
    private BigDecimal outsideLatitude;

    @Column(name = "outside_longitude", precision = 10, scale = 7)
    private BigDecimal outsideLongitude;

    @Column(name = "description_ko", columnDefinition = "TEXT")
    private String descriptionKo;

    @Column(name = "description_en", columnDefinition = "TEXT")
    private String descriptionEn;

    private ExitDetail(
            Long facilityId,
            String exitNumber,
            BigDecimal outsideLatitude,
            BigDecimal outsideLongitude,
            String descriptionKo,
            String descriptionEn
    ) {
        this.facilityId = facilityId;
        this.exitNumber = exitNumber;
        this.outsideLatitude = outsideLatitude;
        this.outsideLongitude = outsideLongitude;
        this.descriptionKo = descriptionKo;
        this.descriptionEn = descriptionEn;
    }

    public static ExitDetail create(
            Long facilityId,
            String exitNumber,
            BigDecimal outsideLatitude,
            BigDecimal outsideLongitude,
            String descriptionKo,
            String descriptionEn
    ) {
        return new ExitDetail(facilityId, exitNumber, outsideLatitude, outsideLongitude, descriptionKo, descriptionEn);
    }

    public void update(
            String exitNumber,
            BigDecimal outsideLatitude,
            BigDecimal outsideLongitude,
            String descriptionKo,
            String descriptionEn
    ) {
        this.exitNumber = exitNumber;
        this.outsideLatitude = outsideLatitude;
        this.outsideLongitude = outsideLongitude;
        this.descriptionKo = descriptionKo;
        this.descriptionEn = descriptionEn;
    }
}
