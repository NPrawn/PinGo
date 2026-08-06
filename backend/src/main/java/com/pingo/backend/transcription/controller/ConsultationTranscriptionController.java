package com.pingo.backend.transcription.controller;

import com.pingo.backend.global.response.ApiResponse;
import com.pingo.backend.transcription.dto.TranscriptionResponse;
import com.pingo.backend.transcription.service.ConsultationTranscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/consultations")
@RequiredArgsConstructor
@Tag(name = "상담 음성 인식 API", description = "상담 중 녹음된 발화 한 토막을 글로 옮긴다.")
public class ConsultationTranscriptionController {

    private final ConsultationTranscriptionService transcriptionService;

    /**
     * 사용자는 로그인하지 않으므로 인증을 요구하지 않는다. 번역 API 와 같은 규약이다 —
     * 상담 식별자를 경로에 두는 것은 어느 상담에서 나온 요청인지 로그로 따라갈 수 있게 하기
     * 위해서다.
     */
    @SecurityRequirements
    @Operation(
            summary = "상담 발화 받아쓰기",
            description = "브라우저가 녹음한 발화 한 토막을 글로 옮긴다. 알아듣지 못하면 빈 글을 돌려준다."
    )
    @PostMapping(value = "/{consultationId}/transcribe", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ApiResponse<TranscriptionResponse> transcribe(
            @PathVariable String consultationId,
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String language
    ) {
        return ApiResponse.success(transcriptionService.transcribe(consultationId, file, language));
    }
}
