package com.pingo.backend.station.dto.response;

import com.pingo.backend.station.domain.Station;

public record StationNearbyResponse(
        Long stationId,
        String nameKo,
        String nameEn,
        String lineInfo,
        long distanceM
) {

    public static StationNearbyResponse of(Station station, long distanceM) {
        return new StationNearbyResponse(
                station.getId(),
                station.getNameKo(),
                station.getNameEn(),
                station.getLineInfo(),
                distanceM
        );
    }
}
