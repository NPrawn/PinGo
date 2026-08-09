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

/**
 * 층별 지도 이미지와 좌표 프레임.
 *
 * <p>{@code scaleMPerPx}·{@code originPxX}·{@code originPxY}·{@code frameAngleDeg} 네 값이
 * 캐노니컬 미터 좌표를 이 이미지의 픽셀로 변환하는 데 필요한 전부다. 넷은 함께 있어야 의미가 있고,
 * 하나라도 비어 있으면 지도 표시는 되지만 좌표 오버레이는 할 수 없다.
 *
 * <p>층마다 값이 다르다. 원본 평면도의 크기·여백이 층마다 달라 원점 픽셀이 다르고,
 * 평면도를 교체하면 같은 층이라도 값이 바뀐다.
 *
 * <p>층 높이(z)는 두지 않는다. 위 변환에 쓰이지 않을뿐더러, 같은 층 안에 높이가 다른 노드가
 * 있을 수 있어(역삼역 B1 의 B0.5 중간층) 층 단위 z 는 틀린 값이 된다. 높이는 {@code route_node.map_z} 다.
 */
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

    /**
     * 지도 파일 URL. 좌표 프레임만 등록하고 이미지는 나중에 올리는 경우가 있어 null 을 허용한다.
     * null 이면 클라이언트가 자체 이미지를 사용한다.
     */
    @Column(name = "map_url", length = 500)
    private String mapUrl;

    @Column(name = "width")
    private Integer width;

    @Column(name = "height")
    private Integer height;

    @Column(name = "scale_m_per_px", precision = 10, scale = 6)
    private BigDecimal scaleMPerPx;

    @Column(name = "origin_px_x", precision = 10, scale = 3)
    private BigDecimal originPxX;

    @Column(name = "origin_px_y", precision = 10, scale = 3)
    private BigDecimal originPxY;

    @Column(name = "frame_angle_deg", precision = 10, scale = 4)
    private BigDecimal frameAngleDeg;

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
            BigDecimal originPxX,
            BigDecimal originPxY,
            BigDecimal frameAngleDeg,
            String version
    ) {
        this.floorId = floorId;
        this.mapType = mapType;
        this.mapUrl = mapUrl;
        this.width = width;
        this.height = height;
        this.scaleMPerPx = scaleMPerPx;
        this.originPxX = originPxX;
        this.originPxY = originPxY;
        this.frameAngleDeg = frameAngleDeg;
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
            BigDecimal originPxX,
            BigDecimal originPxY,
            BigDecimal frameAngleDeg,
            String version
    ) {
        return new FloorMap(floorId, mapType, mapUrl, width, height, scaleMPerPx, originPxX, originPxY, frameAngleDeg, version);
    }

    /**
     * 좌표 오버레이가 가능한지 여부. 프레임 네 값이 모두 있어야 미터 -&gt; 픽셀 변환을 할 수 있다.
     */
    public boolean hasCoordinateFrame() {
        return scaleMPerPx != null && originPxX != null && originPxY != null && frameAngleDeg != null;
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
