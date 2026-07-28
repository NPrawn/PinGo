package com.pingo.backend.localization.service;

import com.pingo.backend.localization.client.dto.AiCameraMetadata;
import com.pingo.backend.localization.client.dto.AiLocalizationRequestMetadata;
import com.pingo.backend.localization.dto.request.CameraMetadataRequest;
import com.pingo.backend.localization.dto.request.LocalizationRequestMetadata;
import org.springframework.stereotype.Component;

@Component
public class AiLocalizationRequestMapper {

    public AiLocalizationRequestMetadata toAiMetadata(LocalizationRequestMetadata metadata) {
        return new AiLocalizationRequestMetadata(
                metadata.stationId(),
                toAiCamera(metadata.camera()),
                metadata.capturedAt()
        );
    }

    private AiCameraMetadata toAiCamera(CameraMetadataRequest camera) {
        if (camera == null) {
            return null;
        }

        return new AiCameraMetadata(
                camera.model(),
                camera.width(),
                camera.height(),
                camera.params(),
                camera.intrinsicsSource()
        );
    }

}
