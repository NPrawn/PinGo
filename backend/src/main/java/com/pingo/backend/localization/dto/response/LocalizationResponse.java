package com.pingo.backend.localization.dto.response;

import java.util.List;

public record LocalizationResponse(
        LocalizationResultStatus resultStatus,
        List<LocalizationCandidateResponse> candidates,
        List<LocalizationFallbackOption> fallbackOptions
) {
}
