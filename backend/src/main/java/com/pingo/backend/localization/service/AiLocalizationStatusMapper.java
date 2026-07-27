package com.pingo.backend.localization.service;

import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import org.springframework.stereotype.Component;

@Component
public class AiLocalizationStatusMapper {

    public LocalizationResultStatus map(String aiStatus, String failureReason) {
        if ("LOCALIZED".equals(aiStatus)) {
            return LocalizationResultStatus.SUCCESS;
        }

        if ("INVALID_IMAGE".equals(aiStatus)) {
            return LocalizationResultStatus.INVALID_IMAGE;
        }

        if ("INVALID_INTRINSICS".equals(aiStatus)) {
            return LocalizationResultStatus.INVALID_INTRINSICS;
        }

        if ("MAP_NOT_LOADED".equals(aiStatus)) {
            return LocalizationResultStatus.MAP_NOT_READY;
        }

        if ("NO_RETRIEVAL_CANDIDATE".equals(aiStatus)
                || "INSUFFICIENT_MATCHES".equals(aiStatus)
                || "POSE_ESTIMATION_FAILED".equals(aiStatus)) {
            return LocalizationResultStatus.NO_MATCH;
        }

        if ("LOW_GEOMETRIC_QUALITY".equals(aiStatus)) {
            return LocalizationResultStatus.LOW_CONFIDENCE;
        }

        if ("OVERLOADED".equals(aiStatus)) {
            return LocalizationResultStatus.OVERLOADED;
        }

        if ("INTERNAL_ERROR".equals(aiStatus) && "ENGINE_NOT_READY".equals(failureReason)) {
            return LocalizationResultStatus.AI_SERVER_UNAVAILABLE;
        }

        return LocalizationResultStatus.INTERNAL_ERROR;
    }

}
