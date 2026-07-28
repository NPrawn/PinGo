package com.pingo.backend.localization.controller;

import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.localization.dto.request.LocalizationRequestMetadata;
import com.pingo.backend.localization.dto.response.LocalizationResponse;
import com.pingo.backend.localization.service.LocalizationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/vps")
@RequiredArgsConstructor
@Tag(name = "위치추정 API", description = "비로그인 사용자의 카메라 이미지 기반 실내 위치추정 API")
public class VpsLocalizationController {

    private final LocalizationService localizationService;

    @PostMapping("/localize")
    @SecurityRequirements
    @Operation(
            summary = "카메라 이미지 기반 위치추정",
            description = "사용자 촬영 이미지와 위치추정 메타데이터를 받아 AI 위치추정 결과 또는 fallback 응답을 반환한다."
    )
    public ApiResponse<LocalizationResponse> localize(
            @RequestPart("image") MultipartFile image,
            @Valid @RequestPart("metadata") LocalizationRequestMetadata metadata
    ) {
        if (image.isEmpty()) {
            throw new BusinessException(ErrorCode.INVALID_REQUEST);
        }

        String requestId = "loc_" + UUID.randomUUID();
        return ApiResponse.success(localizationService.localize(requestId, image, metadata));
    }
}
