package com.pingo.backend.consultation.datachannel;

import com.pingo.backend.consultation.datachannel.dto.request.ConsultationDataChannelEventRequest;
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
public class ConsultationDataChannelEventController {

    private final ConsultationDataChannelEventPublisher dataChannelEventPublisher;

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
