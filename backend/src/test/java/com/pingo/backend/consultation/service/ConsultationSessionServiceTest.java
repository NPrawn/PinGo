package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.response.ConsultationCancelResponse;
import com.pingo.backend.consultation.dto.response.ConsultationCreateResponse;
import com.pingo.backend.consultation.dto.response.ConsultationResponse;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConsultationSessionServiceTest {

    @Mock
    private ConsultationSessionRepository consultationSessionRepository;
    @Mock
    private UserSessionRepository userSessionRepository;
    @Mock
    private StationRepository stationRepository;

    private ConsultationSessionService consultationSessionService;

    @BeforeEach
    void setUp() {
        consultationSessionService = new ConsultationSessionService(
                consultationSessionRepository, userSessionRepository, stationRepository
        );
    }

    private ConsultationCreateRequest validRequest() {
        return new ConsultationCreateRequest(
                "usr_abc123", 1L, ProblemType.CANNOT_FIND_EXIT,
                null, null, null, true, true
        );
    }

    @Test
    void create_성공() {
        UserSession userSession = mock(UserSession.class);
        Station station = mock(Station.class);
        when(userSessionRepository.findById("usr_abc123")).thenReturn(Optional.of(userSession));
        when(userSession.isExpired()).thenReturn(false);
        when(stationRepository.findById(1L)).thenReturn(Optional.of(station));

        ConsultationCreateResponse response = consultationSessionService.create(validRequest());

        assertThat(response.status()).isEqualTo(ConsultationStatus.WAITING);
        verify(consultationSessionRepository).save(any(ConsultationSession.class));
    }

    @Test
    void create_목적지_하나만_오면_INVALID_DESTINATION() {
        ConsultationCreateRequest request = new ConsultationCreateRequest(
                "usr_abc123", 1L, ProblemType.CANNOT_FIND_EXIT,
                null, "place", null, true, true
        );

        assertThatThrownBy(() -> consultationSessionService.create(request))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_DESTINATION);

        verifyNoInteractions(userSessionRepository, stationRepository, consultationSessionRepository);
    }

    @Test
    void create_존재하지_않는_userSession이면_USER_SESSION_NOT_FOUND() {
        when(userSessionRepository.findById("usr_abc123")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.create(validRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.USER_SESSION_NOT_FOUND);
    }

    @Test
    void create_만료된_userSession이면_USER_SESSION_ALREADY_ENDED() {
        UserSession userSession = mock(UserSession.class);
        when(userSessionRepository.findById("usr_abc123")).thenReturn(Optional.of(userSession));
        when(userSession.isExpired()).thenReturn(true);

        assertThatThrownBy(() -> consultationSessionService.create(validRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.USER_SESSION_ALREADY_ENDED);

        verifyNoInteractions(stationRepository);
    }

    @Test
    void create_존재하지_않는_station이면_STATION_NOT_FOUND() {
        UserSession userSession = mock(UserSession.class);
        when(userSessionRepository.findById("usr_abc123")).thenReturn(Optional.of(userSession));
        when(userSession.isExpired()).thenReturn(false);
        when(stationRepository.findById(1L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.create(validRequest()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.STATION_NOT_FOUND);
    }

    @Test
    void get_성공_WAITING이면_signalingRoomId는_null() {
        ConsultationSession session = ConsultationSession.create(
                "usr_abc123", 1L, ProblemType.CANNOT_FIND_EXIT, null, null, null, true, true
        );
        when(consultationSessionRepository.findById(session.getConsultationId()))
                .thenReturn(Optional.of(session));

        ConsultationResponse response = consultationSessionService.get(session.getConsultationId());

        assertThat(response.consultationId()).isEqualTo(session.getConsultationId());
        assertThat(response.signalingRoomId()).isNull();
    }

    @Test
    void get_존재하지_않으면_CONSULTATION_NOT_FOUND() {
        when(consultationSessionRepository.findById("cs_none")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.get("cs_none"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void cancel_WAITING이면_성공() {
        ConsultationSession session = ConsultationSession.create(
                "usr_abc123", 1L, ProblemType.CANNOT_FIND_EXIT, null, null, null, true, true
        );
        when(consultationSessionRepository.findById(session.getConsultationId()))
                .thenReturn(Optional.of(session));

        ConsultationCancelResponse response = consultationSessionService.cancel(session.getConsultationId());

        assertThat(response.status()).isEqualTo(ConsultationStatus.CANCELED);
        assertThat(session.getStatus()).isEqualTo(ConsultationStatus.CANCELED);
    }

    @Test
    void cancel_존재하지_않으면_CONSULTATION_NOT_FOUND() {
        when(consultationSessionRepository.findById("cs_none")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.cancel("cs_none"))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void cancel_이미_취소된_상담을_다시_취소하면_CONSULTATION_NOT_CANCELABLE() {
        ConsultationSession session = ConsultationSession.create(
                "usr_abc123", 1L, ProblemType.CANNOT_FIND_EXIT, null, null, null, true, true
        );
        session.cancel();
        when(consultationSessionRepository.findById(session.getConsultationId()))
                .thenReturn(Optional.of(session));

        assertThatThrownBy(() -> consultationSessionService.cancel(session.getConsultationId()))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.CONSULTATION_NOT_CANCELABLE);
    }
}