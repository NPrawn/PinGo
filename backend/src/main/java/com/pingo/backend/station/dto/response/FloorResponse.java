package com.pingo.backend.station.dto.response;

import com.pingo.backend.station.domain.StationFloor;
import io.swagger.v3.oas.annotations.media.Schema;

import java.math.BigDecimal;

public record FloorResponse(
        Long floorId,
        String floorCode,
        String floorName,
        String spaceType,
        int floorOrder,

        @Schema(
                description = """
                        층의 캐노니컬 기준 높이(m). 층 바닥 기준이며 역삼역은 B1=5 · B2=0 · B3=-5.
                        클라이언트가 층 전환을 판정하는 데 쓴다.
                        """,
                example = "0.0",
                nullable = true
        )
        BigDecimal nominalZ
) {

    public static FloorResponse from(StationFloor floor) {
        return new FloorResponse(
                floor.getId(),
                floor.getFloorCode(),
                floor.getFloorName(),
                floor.getSpaceType(),
                floor.getFloorOrder(),
                floor.getNominalZ()
        );
    }
}
