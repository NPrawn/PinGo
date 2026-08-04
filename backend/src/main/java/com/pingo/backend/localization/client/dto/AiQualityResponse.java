package com.pingo.backend.localization.client.dto;

public record AiQualityResponse(
        Integer numMatches,
        Integer numCorrespondences,
        Integer numInliers,
        Double inlierRatio,
        Double medianReprojectionErrorPx,
        Integer retrievedImages,
        Integer supportingImages,
        String intrinsicsSource,
        Double confidenceScore
) {

}
