package com.pingo.backend.localization.dto.request;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CameraMetadataRequest(
        @Schema(description = "카메라 모델", example = "PINHOLE")
        String model,

        @Schema(description = "촬영 이미지 너비(px)", example = "1280")
        @Min(1)
        Integer width,

        @Schema(description = "촬영 이미지 높이(px)", example = "720")
        @Min(1)
        Integer height,

        @Schema(description = "카메라 내부 파라미터", example = "1050.2, 1048.8, 640.0, 360.0]")
        @Size(min = 4, max = 4)
        List<Double> params,

        @Schema(description = "카메라 내부 파라미터 출처", example = "DEVICE_PROFILE")
        String intrinsicsSource
) {

}
