package com.pingo.backend.consultation.datachannel;

import com.pingo.backend.consultation.datachannel.dto.request.ConsultationDataChannelEventRequest;
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
@Tag(name = "상담 DataChannel Fallback API", description = "DataChannel 실패 시 상담 이벤트를 REST와 SSE로 전달하기 위한 공개 API")
public class ConsultationDataChannelEventController {

    private final ConsultationDataChannelEventPublisher dataChannelEventPublisher;

    @SecurityRequirements
    @Operation(
            summary = "DataChannel fallback 이벤트 발행",
            description = "DataChannel 연결 실패 또는 보조 전달이 필요한 경우 화살표, 안내 메시지, 목적지 변경 이벤트를 서버에 알린다. 인증이 필요 없는 공개 API다."
    )
    @ApiResponses({
            @io.swagger.v3.oas.annotations.responses.ApiResponse(
                    responseCode = "200",
                    description = "DataChannel fallback 이벤트 발행 성공",
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
                    description = "DataChannel 이벤트 타입 누락 또는 지원하지 않는 enum 값",
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
    @PostMapping("/{consultationRequestId}/data-channel-events")
    public ApiResponse<Void> publishDataChannelEvent(
            @PathVariable String consultationRequestId,
            @Valid @RequestBody ConsultationDataChannelEventRequest request
    ) {
        dataChannelEventPublisher.publish(
                consultationRequestId,
                request.type(),
                request.payload()
        );
        return ApiResponse.success();
    }
}
