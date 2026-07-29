package com.pingo.backend.localization.client;

import com.pingo.backend.localization.client.dto.AiLocalizationRequestMetadata;
import com.pingo.backend.localization.client.dto.AiLocalizationResponse;
import org.springframework.web.multipart.MultipartFile;

public interface AiLocalizationClient {

    AiLocalizationResponse localize(
            String requestId,
            String mapVersion,
            MultipartFile image,
            AiLocalizationRequestMetadata metadata
    );
}
