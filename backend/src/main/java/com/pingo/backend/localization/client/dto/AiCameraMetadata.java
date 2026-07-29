package com.pingo.backend.localization.client.dto;

import java.util.List;

public record AiCameraMetadata(
        String model,
        Integer width,
        Integer height,
        List<Double> params,
        String intrinsicsSource
) {

}
