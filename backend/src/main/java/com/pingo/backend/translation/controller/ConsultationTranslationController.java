package com.pingo.backend.translation.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.translation.dto.TranslationRequest;
import com.pingo.backend.translation.dto.TranslationResponse;
import com.pingo.backend.translation.service.ConsultationTranslationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/consultations")
@RequiredArgsConstructor
@Tag(name = "상담 실시간 번역 API", description = "상담 중 오가는 자막 한 줄을 상대 언어로 옮긴다.")
public class ConsultationTranslationController {

    private final ConsultationTranslationService translationService;

    /**
     * 사용자는 로그인하지 않으므로 인증을 요구하지 않는다. 상담 식별자를 경로에 두는 것은
     * 어느 상담에서 나온 요청인지 로그로 따라갈 수 있게 하기 위해서다.
     */
    @SecurityRequirements
    @Operation(
            summary = "상담 자막 번역",
            description = "실시간 자막 한 줄을 요청한 언어로 옮긴다. 옮기지 못하면 원문을 그대로 돌려준다."
    )
    @PostMapping("/{consultationId}/translate")
    public ApiResponse<TranslationResponse> translate(
            @PathVariable String consultationId,
            @Valid @RequestBody TranslationRequest request
    ) {
        return ApiResponse.success(translationService.translate(request));
    }
}
