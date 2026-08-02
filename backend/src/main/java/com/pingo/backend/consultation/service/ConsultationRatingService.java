package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.dto.request.ConsultationRatingRequest;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ConsultationRatingService {

    private static final int MIN_SCORE = 1;
    private static final int MAX_SCORE = 5;

    private final ConsultationSessionRepository consultationSessionRepository;

    @Transactional
    public ConsultationRatingRequest.Response rate(String consultationId,
                                                   ConsultationRatingRequest request) {
        if (request.score() < MIN_SCORE || request.score() > MAX_SCORE) {
            throw new BusinessException(ErrorCode.INVALID_RATING_SCORE);
        }

        ConsultationSession session = consultationSessionRepository.findByIdForUpdate(consultationId)
                .orElseThrow(() -> new BusinessException(ErrorCode.CONSULTATION_NOT_FOUND));

        if (!Objects.equals(session.getUserSessionId(), request.userSessionId())) {
            throw new BusinessException(ErrorCode.CONSULTATION_SESSION_MISMATCH);
        }
        if (session.getStatus() != ConsultationStatus.ENDED) {
            throw new BusinessException(ErrorCode.CONSULTATION_NOT_ENDED);
        }
        if (session.isRated()) {
            throw new BusinessException(ErrorCode.CONSULTATION_ALREADY_RATED);
        }

        session.rate(request.score());
        return ConsultationRatingRequest.Response.from(session);
    }
}