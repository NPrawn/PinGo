package com.pingo.backend.station.dto.response;

import com.pingo.backend.station.domain.Station;

import java.math.BigDecimal;
import java.util.List;

public record StationDetailResponse(
        Long stationId,
        String nameKo,
        String nameEn,
        String lineInfo,
        BigDecimal latitude,
        BigDecimal longitude,
        List<FloorResponse> floors
) {

    public static StationDetailResponse of(Station station, List<FloorResponse> floors) {
        return new StationDetailResponse(
                station.getId(),
                station.getNameKo(),
                station.getNameEn(),
                station.getLineInfo(),
                station.getLatitude(),
                station.getLongitude(),
                List.copyOf(floors)
        );
    }
}
