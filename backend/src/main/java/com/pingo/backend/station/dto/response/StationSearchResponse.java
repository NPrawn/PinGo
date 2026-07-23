package com.pingo.backend.station.dto.response;

import com.pingo.backend.station.domain.Station;

public record StationSearchResponse(
        Long stationId,
        String nameKo,
        String nameEn,
        String lineInfo
) {

    public static StationSearchResponse from(Station station) {
        return new StationSearchResponse(
                station.getId(),
                station.getNameKo(),
                station.getNameEn(),
                station.getLineInfo()
        );
    }
}
