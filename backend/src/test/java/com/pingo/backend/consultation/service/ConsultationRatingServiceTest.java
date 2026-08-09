package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.dto.request.ConsultationRatingRequest;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("상담 만족도 평가 서비스")
class ConsultationRatingServiceTest {

    private static final String CONSULTATION_ID = "cs_test1234";
    private static final String USER_SESSION_ID = "usr_test1234";

    @Mock private ConsultationSessionRepository consultationSessionRepository;
    @InjectMocks private ConsultationRatingService consultationRatingService;

    @Mock private ConsultationSession session;

    @BeforeEach
    void setUp() {
        given(session.getConsultationId()).willReturn(CONSULTATION_ID);
        given(session.getUserSessionId()).willReturn(USER_SESSION_ID);
        given(session.getStatus()).willReturn(ConsultationStatus.ENDED);
        given(session.isRated()).willReturn(false);
        given(consultationSessionRepository.findByIdForUpdate(CONSULTATION_ID))
                .willReturn(Optional.of(session));
    }

    @Test
    @DisplayName("정상 평가 시 엔티티에 점수가 기록된다")
    void success() {
        consultationRatingService.rate(CONSULTATION_ID,
                new ConsultationRatingRequest(USER_SESSION_ID, 5));

        verify(session).rate(5);
    }

    @Test
    @DisplayName("존재하지 않는 상담이면 CONSULTATION_NOT_FOUND 예외가 발생한다")
    void notFound() {
        given(consultationSessionRepository.findByIdForUpdate(CONSULTATION_ID))
                .willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationRatingService.rate(CONSULTATION_ID,
                new ConsultationRatingRequest(USER_SESSION_ID, 5)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    @DisplayName("다른 세션이 평가하면 CONSULTATION_SESSION_MISMATCH 예외가 발생한다")
    void sessionMismatch() {
        assertThatThrownBy(() -> consultationRatingService.rate(CONSULTATION_ID,
                new ConsultationRatingRequest("usr_other", 5)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONSULTATION_SESSION_MISMATCH);

        verify(session, never()).rate(org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    @DisplayName("종료되지 않은 상담이면 CONSULTATION_NOT_ENDED 예외가 발생한다")
    void notEnded() {
        given(session.getStatus()).willReturn(ConsultationStatus.IN_PROGRESS);

        assertThatThrownBy(() -> consultationRatingService.rate(CONSULTATION_ID,
                new ConsultationRatingRequest(USER_SESSION_ID, 5)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONSULTATION_NOT_ENDED);
    }

    @Test
    @DisplayName("이미 평가한 상담이면 CONSULTATION_ALREADY_RATED 예외가 발생한다")
    void alreadyRated() {
        given(session.isRated()).willReturn(true);

        assertThatThrownBy(() -> consultationRatingService.rate(CONSULTATION_ID,
                new ConsultationRatingRequest(USER_SESSION_ID, 5)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONSULTATION_ALREADY_RATED);
    }

    @Test
    @DisplayName("범위를 벗어난 점수면 INVALID_RATING_SCORE 예외가 발생한다")
    void invalidScore() {
        verify(consultationSessionRepository, never()).findByIdForUpdate(any());
        assertThatThrownBy(() -> consultationRatingService.rate(CONSULTATION_ID,
                new ConsultationRatingRequest(USER_SESSION_ID, 6)))
                .isInstanceOf(BusinessException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_RATING_SCORE);
    }
}