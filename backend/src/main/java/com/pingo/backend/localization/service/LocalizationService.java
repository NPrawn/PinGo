package com.pingo.backend.localization.service;

import com.pingo.backend.localization.client.AiLocalizationClient;
import com.pingo.backend.localization.client.AiLocalizationClientErrorType;
import com.pingo.backend.localization.client.AiLocalizationClientException;
import com.pingo.backend.localization.client.dto.AiLocalizationRequestMetadata;
import com.pingo.backend.localization.client.dto.AiLocalizationResponse;
import com.pingo.backend.localization.dto.response.LocalizationResponse;
import com.pingo.backend.localization.dto.response.LocalizationResultStatus;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class LocalizationService {

    private final AiLocalizationClient aiLocalizationClient;
    private final AiLocalizationStatusMapper statusMapper;
    private final LocalizationFallbackPolicy fallbackPolicy;

    public LocalizationService(
            AiLocalizationClient aiLocalizationClient,
            AiLocalizationStatusMapper statusMapper,
            LocalizationFallbackPolicy fallbackPolicy
    ) {
        this.aiLocalizationClient = aiLocalizationClient;
        this.statusMapper = statusMapper;
        this.fallbackPolicy = fallbackPolicy;
    }

    public LocalizationResponse localize(
            String requestId,
            String mapVersion,
            MultipartFile image,
            AiLocalizationRequestMetadata metadata
    ) {
        try {
            AiLocalizationResponse aiResponse = aiLocalizationClient.localize(requestId, mapVersion, image, metadata);
            LocalizationResultStatus resultStatus = statusMapper.map(
                    aiResponse.status().name(),
                    aiResponse.failureReason()
            );

            return responseFor(resultStatus);
        } catch (AiLocalizationClientException e) {
            return responseFor(mapClientError(e.getErrorType()));
        }
    }

    private LocalizationResponse responseFor(LocalizationResultStatus resultStatus) {
        return new LocalizationResponse(
                resultStatus,
                List.of(),
                fallbackPolicy.optionsFor(resultStatus)
        );
    }

    private LocalizationResultStatus mapClientError(AiLocalizationClientErrorType errorType) {
        return switch (errorType) {
            case TIMEOUT -> LocalizationResultStatus.TIMEOUT;
            case UNAVAILABLE -> LocalizationResultStatus.AI_SERVER_UNAVAILABLE;
            case BAD_REQUEST, INTERNAL_ERROR -> LocalizationResultStatus.INTERNAL_ERROR;
        };
    }
}
