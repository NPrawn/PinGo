package com.pingo.backend.consultation.dto.response;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationSummary;
import com.pingo.backend.consultation.domain.SummaryStatus;
import com.pingo.backend.usersession.domain.Language;

import java.time.Instant;
import java.util.List;

public record ConsultationSummaryResponse(
        String consultationId,
        SummaryStatus status,
        String counselorName,
        Instant endedAt,
        Language language,
        String summaryText,
        String startLocationLabel,
        Long guidedExitFacilityId,
        String guidedExitLabel,
        String routeType,
        List<TranscriptSegmentResponse> transcript,
        Instant createdAt,
        Instant completedAt
) {
    public static ConsultationSummaryResponse of(ConsultationSummary summary,
                                                 String counselorName,
                                                 Instant endedAt,
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
                // 시간대를 붙여 내보낸다. 없으면 브라우저가 자기 시간대로 읽어 9시간 어긋난다.
                ConsultationSession.toInstant(summary.getCreatedAt()),
                ConsultationSession.toInstant(summary.getCompletedAt())
        );
    }
}