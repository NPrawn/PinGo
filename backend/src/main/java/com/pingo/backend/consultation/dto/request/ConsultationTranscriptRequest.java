package com.pingo.backend.consultation.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import java.util.List;

public record ConsultationTranscriptRequest(

        @Valid
        @Size(max = 500)
        List<TranscriptSegmentRequest> transcript,

        @Size(max = 200) String startLocationLabel,
        Long guidedExitFacilityId,
        @Size(max = 100) String guidedExitLabel,
        @Size(max = 20) String routeType
) {}