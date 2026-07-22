package com.pingo.backend.facility.dto.response;

import com.pingo.backend.facility.domain.ExitDetail;

import java.math.BigDecimal;

public record ExitDetailResponse(
        String exitNumber,
        BigDecimal outsideLatitude,
        BigDecimal outsideLongitude,
        String descriptionKo,
        String descriptionEn
) {

    public static ExitDetailResponse from(ExitDetail exitDetail) {
        return new ExitDetailResponse(
                exitDetail.getExitNumber(),
                exitDetail.getOutsideLatitude(),
                exitDetail.getOutsideLongitude(),
                exitDetail.getDescriptionKo(),
                exitDetail.getDescriptionEn()
        );
    }
}
