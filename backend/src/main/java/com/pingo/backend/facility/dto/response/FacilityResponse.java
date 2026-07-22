package com.pingo.backend.facility.dto.response;

import com.pingo.backend.facility.domain.Facility;

import java.math.BigDecimal;

public record FacilityResponse(
        Long facilityId,
        Long stationId,
        Long floorId,
        String facilityType,
        String nameKo,
        String nameEn,
        BigDecimal mapX,
        BigDecimal mapY,
        Long linkedNodeId,
        boolean isAccessible
) {

    public static FacilityResponse from(Facility facility) {
        return new FacilityResponse(
                facility.getId(),
                facility.getStationId(),
                facility.getFloorId(),
                facility.getFacilityType(),
                facility.getNameKo(),
                facility.getNameEn(),
                facility.getMapX(),
                facility.getMapY(),
                facility.getLinkedNodeId(),
                facility.isAccessible()
        );
    }
}
