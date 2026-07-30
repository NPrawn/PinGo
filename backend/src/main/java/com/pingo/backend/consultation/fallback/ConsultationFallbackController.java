package com.pingo.backend.consultation.fallback;

import com.pingo.backend.consultation.fallback.dto.request.ConsultationFallbackEventRequest;
import com.pingo.backend.global.response.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
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
@Tag(name = "상담 WebRTC Fallback API", description = "WebRTC 영상·음성·채팅 전환 상태를 발행하는 공개 API")
public class ConsultationFallbackController {

    private final ConsultationFallbackEventPublisher fallbackEventPublisher;

    @SecurityRequirements
    @Operation(
            summary = "WebRTC fallback 이벤트 발행",
            description = "WebRTC 상담 중 영상 연결 실패, 음성 상담 전환, 채팅 상담 전환 같은 fallback 상태를 서버에 알린다. 인증이 필요 없는 공개 API다."
    )
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200",
                    description = "fallback 이벤트 발행 성공",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = """
                                            {
                                              "success": true,
                                              "data": null,
                                              "message": null
                                            }
                                            """
                            )
                    )
            ),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "400",
                    description = "fallback 이벤트 타입 누락 또는 지원하지 않는 enum 값",
                    content = @Content(
                            examples = @ExampleObject(
                                    value = """
                                            {
                                              "success": false,
                                              "code": "INVALID_REQUEST",
                                              "message": "요청 형식이 올바르지 않습니다."
                                            }
                                            """
                            )
                    )
            )
    })
    @PostMapping("/{consultationRequestId}/fallback-events")
    public ApiResponse<Void> publishFallbackEvent(
            @PathVariable String consultationRequestId,
            @Valid @RequestBody ConsultationFallbackEventRequest request
    ) {
        publish(consultationRequestId, request);
        return ApiResponse.success();
    }

    private void publish(String consultationRequestId, ConsultationFallbackEventRequest request) {
        switch (request.type()) {
            case VIDEO_FAILED -> fallbackEventPublisher.publishVideoFailed(consultationRequestId, request.reason());
            case AUDIO_ONLY_REQUESTED ->
                    fallbackEventPublisher.publishAudioOnlyRequested(consultationRequestId, request.reason());
            case AUDIO_FAILED -> fallbackEventPublisher.publishAudioFailed(consultationRequestId, request.reason());
            case CHAT_ONLY_REQUESTED ->
                    fallbackEventPublisher.publishChatOnlyRequested(consultationRequestId, request.reason());
            case FALLBACK_CONFIRMED -> fallbackEventPublisher.publishFallbackConfirmed(consultationRequestId, request.reason());
        }
    }
}
