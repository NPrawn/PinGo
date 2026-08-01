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

import java.math.BigDecimal;
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

    /**
     * 캐노니컬 기준 높이(m). 층 바닥 기준이고 역삼역은 B1=5, B2=0, B3=-5 이다.
     *
     * <p>클라이언트가 층 전환을 판정하는 데 쓴다. WebXR 의 앵커 대비 ΔY(미터)와 층 사이 z 차이를
     * 비교해 올라갔는지 내려갔는지 본다. 명목값이며 실측 층고가 아니다 — 부호와 대략적 크기만
     * 쓰므로 충분하다(계단 실측 ΔY 3.80m vs 명목 5m).
     *
     * <p>그 층 <b>바닥</b> 하나뿐이다. 같은 층 안에서 높이가 갈리는 구간(역삼역 B0.5,
     * {@code floor_code=B1} 안의 {@code map_z=7.5})은 이 값으로 구분할 수 없고
     * {@code route_node.map_z} 를 봐야 한다.
     */
    @Column(name = "nominal_z", precision = 10, scale = 3)
    private BigDecimal nominalZ;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    private StationFloor(
            Station station,
            String floorCode,
            String floorName,
            int floorOrder,
            BigDecimal nominalZ
    ) {
        this.station = station;
        this.floorCode = floorCode;
        this.floorName = floorName;
        this.floorOrder = floorOrder;
        this.nominalZ = nominalZ;
    }

    public static StationFloor create(
            Station station,
            String floorCode,
            String floorName,
            int floorOrder,
            BigDecimal nominalZ
    ) {
        return new StationFloor(station, floorCode, floorName, floorOrder, nominalZ);
    }

    public void update(String floorCode, String floorName, int floorOrder, BigDecimal nominalZ) {
        this.floorCode = floorCode;
        this.floorName = floorName;
        this.floorOrder = floorOrder;
        this.nominalZ = nominalZ;
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
