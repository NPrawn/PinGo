package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSummary;
import com.pingo.backend.consultation.domain.SummaryStatus;
import com.pingo.backend.usersession.domain.Language;

import java.time.LocalDateTime;
import java.util.List;

public record ConsultationSummaryResponse(
        String consultationId,
        SummaryStatus status,
        String counselorName,
        LocalDateTime endedAt,
        Language language,
        String summaryText,
        String startLocationLabel,
        Long guidedExitFacilityId,
        String guidedExitLabel,
        String routeType,
        List<TranscriptSegmentResponse> transcript,
        LocalDateTime createdAt,
        LocalDateTime completedAt
) {
    public static ConsultationSummaryResponse of(ConsultationSummary summary,
                                                 String counselorName,
                                                 LocalDateTime endedAt,
                                                 Language language,
                                                 List<TranscriptSegmentResponse> transcript) {
        return new ConsultationSummaryResponse(
                summary.getConsultationId(),
                summary.getStatus(),
                counselorName,
                endedAt,
                language,
                summary.getSummaryText(),
                summary.getStartLocationLabel(),
                summary.getGuidedExitFacilityId(),
                summary.getGuidedExitLabel(),
                summary.getRouteType(),
                transcript,
                summary.getCreatedAt(),
                summary.getCompletedAt()
        );
    }
}