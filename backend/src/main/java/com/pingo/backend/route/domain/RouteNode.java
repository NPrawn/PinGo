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

    /**
     * 캐노니컬 높이(m). 층 바닥이 기준값이고 역삼역은 B1=5, B2=0, B3=-5 이다.
     *
     * <p>같은 층 안에서도 값이 갈릴 수 있다. 역삼역 B1 개찰구 위 중간층(B0.5)은 별도 층이 아니라
     * {@code floor_code=B1} 안의 {@code map_z=7.5} 로 모델링돼 있고 해당 노드가 6개다.
     * 그래서 위치 인식 결과를 노드에 스냅할 때 x·y 만 쓰면 중간층 노드를 바닥으로 착각한다.
     * {@code floor_id} 로 걸러도 둘 다 B1 이라 걸러지지 않는다.
     *
     * <p>컬럼은 nullable 이다(V4 에서 추가). 현재 역삼역 노드 142개는 모두 값이 있다.
     * 값이 없는 노드는 그 층 바닥에 있는 것으로 본다 — 평면 거리로 대신하면 항상 3차원 거리보다
     * 짧아서 높이 없는 노드가 구조적으로 유리해지기 때문이다.
     */
    @Column(name = "map_z", precision = 10, scale = 3)
    private BigDecimal mapZ;

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
            BigDecimal mapZ,
            boolean landmark
    ) {
        this.stationId = stationId;
        this.floorId = floorId;
        this.nodeType = nodeType;
        this.name = name;
        this.mapX = mapX;
        this.mapY = mapY;
        this.mapZ = mapZ;
        this.landmark = landmark;
    }

    public static RouteNode create(
            Long stationId,
            Long floorId,
            String nodeType,
            String name,
            BigDecimal mapX,
            BigDecimal mapY,
            BigDecimal mapZ,
            boolean landmark
    ) {
        return new RouteNode(stationId, floorId, nodeType, name, mapX, mapY, mapZ, landmark);
    }

    public void update(String nodeType, String name, BigDecimal mapX, BigDecimal mapY, BigDecimal mapZ, boolean landmark) {
        this.nodeType = nodeType;
        this.name = name;
        this.mapX = mapX;
        this.mapY = mapY;
        this.mapZ = mapZ;
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
