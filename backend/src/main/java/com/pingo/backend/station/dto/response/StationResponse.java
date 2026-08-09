package com.pingo.backend.station.dto.response;

import com.pingo.backend.station.domain.Station;

import java.math.BigDecimal;

public record StationResponse(
        Long stationId,
        String nameKo,
        String nameEn,
        String lineInfo,
        BigDecimal latitude,
        BigDecimal longitude
) {

    public static StationResponse from(Station station) {
        return new StationResponse(
                station.getId(),
                station.getNameKo(),
                station.getNameEn(),
                station.getLineInfo(),
                station.getLatitude(),
                station.getLongitude()
        );
    }
}
