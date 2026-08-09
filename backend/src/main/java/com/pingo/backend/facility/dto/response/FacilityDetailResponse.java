package com.pingo.backend.facility.dto.response;

import com.pingo.backend.facility.domain.Facility;

import java.math.BigDecimal;

public record FacilityDetailResponse(
        Long facilityId,
        Long stationId,
        Long floorId,
        String facilityType,
        String nameKo,
        String nameEn,
        BigDecimal mapX,
        BigDecimal mapY,
        Long linkedNodeId,
        boolean isAccessible,
        ExitDetailResponse exitDetail
) {

    public static FacilityDetailResponse of(Facility facility, ExitDetailResponse exitDetail) {
        return new FacilityDetailResponse(
                facility.getId(),
                facility.getStationId(),
                facility.getFloorId(),
                facility.getFacilityType(),
                facility.getNameKo(),
                facility.getNameEn(),
                facility.getMapX(),
                facility.getMapY(),
                facility.getLinkedNodeId(),
                facility.isAccessible(),
                exitDetail
        );
    }
}
