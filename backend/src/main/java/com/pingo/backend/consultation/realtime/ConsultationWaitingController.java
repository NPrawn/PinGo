package com.pingo.backend.consultation.realtime;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/consultations")
@RequiredArgsConstructor
public class ConsultationWaitingController {

    private final ConsultationWaitingEmitterRegistry emitterRegistry;

    @SecurityRequirements
    @Operation(
            summary = "상담 대기 상태 SSE 구독",
            description = "상담 요청 ID 기준으로 상담 대기 상태 변경 이벤트를 SSE로 구독한다."
    )
    @GetMapping(value = "/{consultationRequestId}/waiting-events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter subscribeWaitingEvents(
            @PathVariable String consultationRequestId) {
        return emitterRegistry.register(consultationRequestId);
    }
}
