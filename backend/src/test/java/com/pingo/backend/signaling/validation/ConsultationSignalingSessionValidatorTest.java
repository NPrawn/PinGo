package com.pingo.backend.signaling.validation;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.signaling.auth.SignalingPrincipal;
import com.pingo.backend.signaling.dto.SignalingSenderType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ConsultationSignalingSessionValidatorTest {

    @Mock
    private ConsultationSessionRepository consultationSessionRepository;

    private ConsultationSignalingSessionValidator validator;

    @BeforeEach
    void setUp() {
        validator = new ConsultationSignalingSessionValidator(
                consultationSessionRepository,
                new SignalingSessionIdParser()
        );
    }

    @Test
    void validateJoinReturnsValidWhenConsultationIsAccepted() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        SignalingSessionValidationResult result =
                validator.validateJoin(
                        "room_" + session.getConsultationId(),
                        SignalingSenderType.USER,
                        userPrincipal(session)
                );

        assertThat(result).isEqualTo(SignalingSessionValidationResult.VALID);
    }

    @Test
    void validateJoinReturnsValidWhenConsultationIsInProgress() {
        ConsultationSession session = newSession();
        session.accept(100L);
        ReflectionTestUtils.setField(session, "status", ConsultationStatus.IN_PROGRESS);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        SignalingSessionValidationResult result =
                validator.validateJoin(
                        "room_" + session.getConsultationId(),
                        SignalingSenderType.COUNSELOR,
                        counselorPrincipal(session)
                );

        assertThat(result).isEqualTo(SignalingSessionValidationResult.VALID);
    }

    @Test
    void validateJoinReturnsSessionNotFoundWhenSignalingSessionIdIsInvalid() {
        SignalingSessionValidationResult result =
                validator.validateJoin("cs_abc123", SignalingSenderType.USER, null);

        assertThat(result).isEqualTo(SignalingSessionValidationResult.SESSION_NOT_FOUND);
        verify(consultationSessionRepository, never()).findById("cs_abc123");
    }

    @Test
    void validateJoinReturnsSessionNotFoundWhenConsultationDoesNotExist() {
        given(consultationSessionRepository.findById("cs_abc123")).willReturn(Optional.empty());

        SignalingSessionValidationResult result =
                validator.validateJoin("room_cs_abc123", SignalingSenderType.USER, null);

        assertThat(result).isEqualTo(SignalingSessionValidationResult.SESSION_NOT_FOUND);
    }

    @Test
    void validateJoinReturnsSessionNotAcceptedWhenConsultationIsWaiting() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        SignalingSessionValidationResult result =
                validator.validateJoin(
                        "room_" + session.getConsultationId(),
                        SignalingSenderType.USER,
                        userPrincipal(session)
                );

        assertThat(result).isEqualTo(SignalingSessionValidationResult.SESSION_NOT_ACCEPTED);
    }

    @Test
    void validateJoinReturnsSessionClosedWhenConsultationIsEnded() {
        ConsultationSession session = newSession();
        session.accept(100L);
        session.end();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        SignalingSessionValidationResult result =
                validator.validateJoin(
                        "room_" + session.getConsultationId(),
                        SignalingSenderType.USER,
                        userPrincipal(session)
                );

        assertThat(result).isEqualTo(SignalingSessionValidationResult.SESSION_CLOSED);
    }

    @Test
    void validateJoinReturnsUnauthorizedParticipantWhenSenderTypeIsSystem() {
        SignalingSessionValidationResult result =
                validator.validateJoin("room_cs_abc123", SignalingSenderType.SYSTEM, null);

        assertThat(result).isEqualTo(SignalingSessionValidationResult.UNAUTHORIZED_PARTICIPANT);
        verify(consultationSessionRepository, never()).findById("cs_abc123");
    }

    @Test
    void validateJoinReturnsUnauthorizedParticipantWhenPrincipalIsMissing() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        SignalingSessionValidationResult result =
                validator.validateJoin("room_" + session.getConsultationId(), SignalingSenderType.USER, null);

        assertThat(result).isEqualTo(SignalingSessionValidationResult.UNAUTHORIZED_PARTICIPANT);
    }

    @Test
    void validateJoinReturnsUnauthorizedParticipantWhenPrincipalSenderTypeDoesNotMatch() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        SignalingSessionValidationResult result =
                validator.validateJoin(
                        "room_" + session.getConsultationId(),
                        SignalingSenderType.USER,
                        counselorPrincipal(session)
                );

        assertThat(result).isEqualTo(SignalingSessionValidationResult.UNAUTHORIZED_PARTICIPANT);
    }

    @Test
    void validateJoinReturnsUnauthorizedParticipantWhenPrincipalConsultationIdDoesNotMatch() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        SignalingPrincipal principal = new SignalingPrincipal(
                "cs_other",
                SignalingSenderType.USER,
                session.getUserSessionId(),
                null
        );

        SignalingSessionValidationResult result =
                validator.validateJoin("room_" + session.getConsultationId(), SignalingSenderType.USER, principal);

        assertThat(result).isEqualTo(SignalingSessionValidationResult.UNAUTHORIZED_PARTICIPANT);
    }

    @Test
    void validateJoinReturnsUnauthorizedParticipantWhenUserSessionIdDoesNotMatch() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        SignalingPrincipal principal = new SignalingPrincipal(
                session.getConsultationId(),
                SignalingSenderType.USER,
                "usr_other",
                null
        );

        SignalingSessionValidationResult result =
                validator.validateJoin("room_" + session.getConsultationId(), SignalingSenderType.USER, principal);

        assertThat(result).isEqualTo(SignalingSessionValidationResult.UNAUTHORIZED_PARTICIPANT);
    }

    @Test
    void validateJoinReturnsUnauthorizedParticipantWhenCounselorIdDoesNotMatch() {
        ConsultationSession session = newSession();
        session.accept(100L);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        SignalingPrincipal principal = new SignalingPrincipal(
                session.getConsultationId(),
                SignalingSenderType.COUNSELOR,
                null,
                200L
        );

        SignalingSessionValidationResult result =
                validator.validateJoin(
                        "room_" + session.getConsultationId(),
                        SignalingSenderType.COUNSELOR,
                        principal
                );

        assertThat(result).isEqualTo(SignalingSessionValidationResult.UNAUTHORIZED_PARTICIPANT);
    }

    @Test
    void validateJoinIsReadOnlyTransactional() throws NoSuchMethodException {
        Method method = ConsultationSignalingSessionValidator.class.getDeclaredMethod(
                "validateJoin",
                String.class,
                SignalingSenderType.class,
                SignalingPrincipal.class
        );

        Transactional transactional = method.getAnnotation(Transactional.class);

        assertThat(transactional).isNotNull();
        assertThat(transactional.readOnly()).isTrue();
    }

    private SignalingPrincipal userPrincipal(ConsultationSession session) {
        return new SignalingPrincipal(
                session.getConsultationId(),
                SignalingSenderType.USER,
                session.getUserSessionId(),
                null
        );
    }

    private SignalingPrincipal counselorPrincipal(ConsultationSession session) {
        return new SignalingPrincipal(
                session.getConsultationId(),
                SignalingSenderType.COUNSELOR,
                null,
                session.getCounselorId()
        );
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
                true
        );
    }
}
