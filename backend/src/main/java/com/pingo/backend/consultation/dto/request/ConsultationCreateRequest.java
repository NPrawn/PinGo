package com.pingo.backend.consultation.dto.request;

import com.pingo.backend.consultation.domain.ProblemType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ConsultationCreateRequest (
        @NotBlank String userSessionId,
        @NotNull Long stationId,
        @NotNull ProblemType problemType,
        Long currentNodeId,
        String destinationType,
        Long destinationId,
        boolean videoConsent,
        boolean audioConsent,
        boolean locationConsent
){
}
