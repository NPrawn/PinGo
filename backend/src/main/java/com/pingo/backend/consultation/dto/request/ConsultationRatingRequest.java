package com.pingo.backend.consultation.dto.request;

import com.pingo.backend.consultation.domain.ConsultationSession;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;

public record ConsultationRatingRequest(

        @NotBlank
        String userSessionId,

        @NotNull
        Integer score
) {
    public record Response(
            String consultationId,
            Integer score,
            LocalDateTime ratedAt
    ) {
        public static Response from(ConsultationSession session) {
            return new Response(
                    session.getConsultationId(),
                    session.getRatingScore(),
                    session.getRatedAt()
            );
        }
    }
}