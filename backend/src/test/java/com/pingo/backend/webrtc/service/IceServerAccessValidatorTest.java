package com.pingo.backend.webrtc.service;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.signaling.auth.SignalingAccessTokenProvider;
import com.pingo.backend.signaling.auth.SignalingPrincipal;
import com.pingo.backend.signaling.dto.SignalingSenderType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class IceServerAccessValidatorTest {

    @Mock
    private SignalingAccessTokenProvider signalingAccessTokenProvider;

    @Mock
    private ConsultationSessionRepository consultationSessionRepository;

    private IceServerAccessValidator validator;

    @BeforeEach
    void setUp() {
        validator = new IceServerAccessValidator(signalingAccessTokenProvider, consultationSessionRepository);
    }

    @Test
    void validateSucceedsWhenConsultationIsAccepted() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(signalingAccessTokenProvider.parseToken("signaling-token"))
                .willReturn(userPrincipal(session.getConsultationId()));
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        validator.validate("signaling-token");
    }

    @Test
    void validateSucceedsWhenConsultationIsInProgress() {
        ConsultationSession session = newSession();
        session.accept(100L);
        ReflectionTestUtils.setField(session, "status", ConsultationStatus.IN_PROGRESS);
        given(signalingAccessTokenProvider.parseToken("signaling-token"))
                .willReturn(counselorPrincipal(session.getConsultationId(), 100L));
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        validator.validate("signaling-token");
    }

    @Test
    void validateRejectsMissingToken() {
        assertThatThrownBy(() -> validator.validate(null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);

        verify(signalingAccessTokenProvider, never()).parseToken(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void validateRejectsInvalidToken() {
        given(signalingAccessTokenProvider.parseToken("invalid-token"))
                .willThrow(new IllegalArgumentException("invalid token"));

        assertThatThrownBy(() -> validator.validate("invalid-token"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);

        verify(consultationSessionRepository, never()).findById(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void validateRejectsMissingConsultation() {
        given(signalingAccessTokenProvider.parseToken("signaling-token"))
                .willReturn(userPrincipal("cs_notfound"));
        given(consultationSessionRepository.findById("cs_notfound"))
                .willReturn(Optional.empty());

        assertThatThrownBy(() -> validator.validate("signaling-token"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);
    }

    @Test
    void validateRejectsEndedConsultation() {
        ConsultationSession session = newSession();
        session.accept(100L);
        session.end();
        given(signalingAccessTokenProvider.parseToken("signaling-token"))
                .willReturn(userPrincipal(session.getConsultationId()));
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        assertThatThrownBy(() -> validator.validate("signaling-token"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);
    }

    @Test
    void validateRejectsWaitingConsultation() {
        ConsultationSession session = newSession();
        given(signalingAccessTokenProvider.parseToken("signaling-token"))
                .willReturn(userPrincipal(session.getConsultationId()));
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        assertThatThrownBy(() -> validator.validate("signaling-token"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);
    }

    @Test
    void validateRejectsSystemPrincipal() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(signalingAccessTokenProvider.parseToken("signaling-token"))
                .willReturn(new SignalingPrincipal(
                        session.getConsultationId(),
                        SignalingSenderType.SYSTEM,
                        null,
                        null
                ));
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        assertThatThrownBy(() -> validator.validate("signaling-token"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);
    }

    @Test
    void validateRejectsDifferentUserSession() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(signalingAccessTokenProvider.parseToken("signaling-token"))
                .willReturn(new SignalingPrincipal(
                        session.getConsultationId(),
                        SignalingSenderType.USER,
                        "usr_other",
                        null
                ));
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        assertThatThrownBy(() -> validator.validate("signaling-token"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);
    }

    @Test
    void validateRejectsDifferentCounselor() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(signalingAccessTokenProvider.parseToken("signaling-token"))
                .willReturn(counselorPrincipal(session.getConsultationId(), 200L));
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        assertThatThrownBy(() -> validator.validate("signaling-token"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);
    }

    private SignalingPrincipal userPrincipal(String consultationId) {
        return new SignalingPrincipal(consultationId, SignalingSenderType.USER, "usr_abc123", null);
    }

    private SignalingPrincipal counselorPrincipal(String consultationId, Long accountId) {
        return new SignalingPrincipal(consultationId, SignalingSenderType.COUNSELOR, null, accountId);
    }

    private ConsultationSession newSession() {
        return ConsultationSession.create(
                "usr_abc123",
                1L,
                ProblemType.CANNOT_FIND_EXIT,
                15L,
                "place",
                3L,
                true,
                true,
                true
        );
    }
}
