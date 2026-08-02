package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.SummaryStatus;

public record ConsultationSummaryStatusResponse(
        String consultationId,
        SummaryStatus status
) {}