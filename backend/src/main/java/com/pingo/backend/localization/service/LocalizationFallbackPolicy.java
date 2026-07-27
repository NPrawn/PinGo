package com.pingo.backend.localization.service;

import com.pingo.backend.localization.dto.response.LocalizationFallbackOption;
import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class LocalizationFallbackPolicy {

    public List<LocalizationFallbackOption> optionsFor(LocalizationResultStatus status) {
        return switch (status) {
            case SUCCESS -> List.of();
            case LOW_CONFIDENCE, NO_MATCH -> List.of(
                    LocalizationFallbackOption.RETRY_CAPTURE,
                    LocalizationFallbackOption.SELECT_LANDMARK,
                    LocalizationFallbackOption.SELECT_ON_MAP,
                    LocalizationFallbackOption.REQUEST_CONSULTATION
            );
            case TIMEOUT, OVERLOADED, INTERNAL_ERROR -> List.of(
                    LocalizationFallbackOption.RETRY_CAPTURE,
                    LocalizationFallbackOption.SELECT_ON_MAP,
                    LocalizationFallbackOption.REQUEST_CONSULTATION
            );
            case AI_SERVER_UNAVAILABLE, MAP_NOT_READY -> List.of(
                    LocalizationFallbackOption.SELECT_ON_MAP,
                    LocalizationFallbackOption.REQUEST_CONSULTATION
            );
            case INVALID_IMAGE, INVALID_INTRINSICS -> List.of(
                    LocalizationFallbackOption.RETRY_CAPTURE,
                    LocalizationFallbackOption.SELECT_ON_MAP
            );
        };
    }
}
