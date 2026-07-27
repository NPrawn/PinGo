package com.pingo.backend.localization.dto.response;

import java.math.BigDecimal;

public record LocalizationCandidateResponse(
        Long nodeId,
        Long floorId,
        String label,
        BigDecimal mapX,
        BigDecimal mapY,
        BigDecimal confidenceScore,
        String confidenceLabel
) {

}
