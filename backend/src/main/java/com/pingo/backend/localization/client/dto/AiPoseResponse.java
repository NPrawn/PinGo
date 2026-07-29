package com.pingo.backend.localization.client.dto;

import java.util.List;

public record AiPoseResponse(
        String convention,
        List<Double> rotationXyzw,
        List<Double> translation,
        List<Double> cameraCenter
) {

}
