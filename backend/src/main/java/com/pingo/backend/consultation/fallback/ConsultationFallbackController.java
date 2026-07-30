package com.pingo.backend.consultation.fallback;

import com.pingo.backend.consultation.fallback.dto.request.ConsultationFallbackEventRequest;
import com.pingo.backend.global.response.ApiResponse;
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
public class ConsultationFallbackController {

    private final ConsultationFallbackEventPublisher fallbackEventPublisher;

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
