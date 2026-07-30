package com.pingo.backend.consultation.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.response.*;
import com.pingo.backend.consultation.event.ConsultationEndedEvent;
import com.pingo.backend.consultation.realtime.ConsultationWaitingEventPublisher;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.signaling.auth.SignalingAccessTokenProvider;
import com.pingo.backend.station.domain.Station;
import com.pingo.backend.station.repository.StationRepository;
import com.pingo.backend.usersession.domain.UserSession;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ConsultationSessionServiceTest {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private ConsultationSessionRepository consultationSessionRepository;
    @Mock
    private UserSessionRepository userSessionRepository;
    @Mock
    private StationRepository stationRepository;
    @Mock
    private ConsultationWaitingEventPublisher consultationWaitingEventPublisher;
    @Mock
    private ApplicationEventPublisher applicationEventPublisher;
    @Mock
    private SignalingAccessTokenProvider signalingAccessTokenProvider;

    @InjectMocks
    private ConsultationSessionService consultationSessionService;

    private static final String USER_SESSION_ID = "usr_9f3a2b";
    private static final String OTHER_USER_SESSION_ID = "usr_other0";
    private static final Long STATION_ID = 1L;
    private static final Long COUNSELOR_ACCOUNT_ID = 100L;
    private static final Long OTHER_COUNSELOR_ACCOUNT_ID = 101L;
    private static final Long OTHER_STATION_ID = 2L;

    private ConsultationCreateRequest createRequest;
    private UserSession userSession;

    @BeforeEach
    void setUp() {
        createRequest = new ConsultationCreateRequest(
                USER_SESSION_ID, STATION_ID, ProblemType.CANNOT_FIND_EXIT,
                15L, "place", 3L, true, true
        );
        userSession = mock(UserSession.class);
    }

    private ConsultationSession newSession() {
        return ConsultationSession.create(
                USER_SESSION_ID, STATION_ID, ProblemType.CANNOT_FIND_EXIT,
                15L, "place", 3L, true, true
        );
    }

    @Test
    void create_성공() {
        given(userSessionRepository.findById(USER_SESSION_ID)).willReturn(Optional.of(userSession));
        given(userSession.isExpired()).willReturn(false);
        given(consultationSessionRepository.existsByUserSessionIdAndStatusIn(anyString(), any()))
                .willReturn(false);
        given(stationRepository.findById(STATION_ID)).willReturn(Optional.of(mock(Station.class)));

        ConsultationCreateResponse response = consultationSessionService.create(createRequest);

        assertThat(response.status()).isEqualTo(ConsultationStatus.WAITING);
        verify(consultationSessionRepository).save(any(ConsultationSession.class));
    }

    @Test
    void create_실패_존재하지_않는_사용자_세션() {
        given(userSessionRepository.findById(USER_SESSION_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.create(createRequest))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.USER_SESSION_NOT_FOUND);
    }

    @Test
    void create_실패_이미_종료된_사용자_세션() {
        given(userSessionRepository.findById(USER_SESSION_ID)).willReturn(Optional.of(userSession));
        given(userSession.isExpired()).willReturn(true);

        assertThatThrownBy(() -> consultationSessionService.create(createRequest))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.USER_SESSION_ALREADY_ENDED);
    }

    @Test
    void create_실패_이미_활성_상담이_존재함() {
        given(userSessionRepository.findById(USER_SESSION_ID)).willReturn(Optional.of(userSession));
        given(userSession.isExpired()).willReturn(false);
        given(consultationSessionRepository.existsByUserSessionIdAndStatusIn(anyString(), any()))
                .willReturn(true);

        assertThatThrownBy(() -> consultationSessionService.create(createRequest))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_ALREADY_IN_PROGRESS);

        verify(stationRepository, never()).findById(any());
        verify(consultationSessionRepository, never()).save(any());
    }

    @Test
    void create_실패_존재하지_않는_역() {
        given(userSessionRepository.findById(USER_SESSION_ID)).willReturn(Optional.of(userSession));
        given(userSession.isExpired()).willReturn(false);
        given(consultationSessionRepository.existsByUserSessionIdAndStatusIn(anyString(), any()))
                .willReturn(false);
        given(stationRepository.findById(STATION_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.create(createRequest))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.STATION_NOT_FOUND);
    }

    @Test
    void create_실패_목적지_유형과_ID_중_하나만_전달됨() {
        ConsultationCreateRequest invalidRequest = new ConsultationCreateRequest(
                USER_SESSION_ID, STATION_ID, ProblemType.CANNOT_FIND_EXIT,
                15L, "place", null, true, true
        );

        assertThatThrownBy(() -> consultationSessionService.create(invalidRequest))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_DESTINATION);

        verify(userSessionRepository, never()).findById(any());
    }

    @Test
    void get_성공() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        ConsultationResponse response =
                consultationSessionService.get(session.getConsultationId(), USER_SESSION_ID);

        assertThat(response.consultationId()).isEqualTo(session.getConsultationId());
        assertThat(response.signalingAccessToken()).isNull();
    }

    @Test
    void get_성공_수락된_상담이면_사용자_signaling_token을_반환한다() {
        ConsultationSession session = newSession();
        session.accept(COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(signalingAccessTokenProvider.createUserToken(session.getConsultationId(), USER_SESSION_ID))
                .willReturn("user-signaling-token");

        ConsultationResponse response =
                consultationSessionService.get(session.getConsultationId(), USER_SESSION_ID);

        assertThat(response.signalingRoomId()).isEqualTo("room_" + session.getConsultationId());
        assertThat(response.signalingAccessToken()).isEqualTo("user-signaling-token");
    }

    @Test
    void get_실패_존재하지_않는_상담() {
        given(consultationSessionRepository.findById("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.get("cs_notfound", USER_SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void get_실패_상담_소유자가_아님() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        assertThatThrownBy(() -> consultationSessionService.get(session.getConsultationId(), OTHER_USER_SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void cancel_성공() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        ConsultationCancelResponse response =
                consultationSessionService.cancel(session.getConsultationId(), USER_SESSION_ID);

        assertThat(response.status()).isEqualTo(ConsultationStatus.CANCELED);
    }

    @Test
    void cancel_실패_존재하지_않는_상담() {
        given(consultationSessionRepository.findById("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.cancel("cs_notfound", USER_SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void cancel_실패_취소_불가능한_상태() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        consultationSessionService.cancel(session.getConsultationId(), USER_SESSION_ID); // WAITING -> CANCELED

        assertThatThrownBy(() -> consultationSessionService.cancel(session.getConsultationId(), USER_SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_CANCELABLE);
    }

    @Test
    void cancel_실패_상담_소유자가_아님() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        assertThatThrownBy(() -> consultationSessionService.cancel(session.getConsultationId(), OTHER_USER_SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void cancel_실패_소유자가_아니고_취소_불가능한_상태_이면_NOT_FOUND를_반환한다() {
        // 다른 사람 상담이면서 이미 WAITING이 아닌 상태여도, 상태 정보를 흘리지 않고
        // CONSULTATION_NOT_FOUND만 반환해야 한다 (소유자 검증이 상태 검증보다 먼저 실행되어야 함)
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        consultationSessionService.cancel(session.getConsultationId(), USER_SESSION_ID); // 소유자가 먼저 취소 -> CANCELED

        assertThatThrownBy(() -> consultationSessionService.cancel(session.getConsultationId(), OTHER_USER_SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }
    @Test
    void accept_성공() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getAccountId()).willReturn(COUNSELOR_ACCOUNT_ID);
        given(signalingAccessTokenProvider.createCounselorToken(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .willReturn("counselor-signaling-token");

        ConsultationAcceptResponse response =
                consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID);

        assertThat(response.status()).isEqualTo(ConsultationStatus.ACCEPTED);
        assertThat(response.counselorId()).isEqualTo(COUNSELOR_ACCOUNT_ID);
        assertThat(response.signalingRoomId()).isEqualTo("room_" + session.getConsultationId());
        assertThat(response.signalingAccessToken()).isEqualTo("counselor-signaling-token");
        verify(consultationWaitingEventPublisher)
                .publishAccepted(session.getConsultationId(), "room_" + session.getConsultationId());
    }

    @Test
    void accept_실패_존재하지_않는_상담() {
        given(consultationSessionRepository.findById("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.accept("cs_notfound", COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void accept_실패_존재하지_않는_계정() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.ACCOUNT_NOT_FOUND);
    }

    @Test
    void accept_실패_상담자_계정이_아님() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account adminAccount = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(adminAccount));
        given(adminAccount.getAccountType()).willReturn(AccountType.ADMIN);

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.ACCOUNT_NOT_FOUND);
    }

    @Test
    void accept_실패_담당_역이_아님() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(OTHER_STATION_ID);

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_STATION_MISMATCH);
    }

    @Test
    void accept_실패_수락_불가능한_상태() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getAccountId()).willReturn(COUNSELOR_ACCOUNT_ID);

        consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID); // WAITING -> ACCEPTED

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_ACCEPTABLE);
    }

    @Test
    void accept_실패_비활성_계정() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(false);

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INACTIVE_ACCOUNT);
    }

    @Test
    void reject_성공() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getAccountId()).willReturn(COUNSELOR_ACCOUNT_ID);

        ConsultationRejectResponse response =
                consultationSessionService.reject(session.getConsultationId(), COUNSELOR_ACCOUNT_ID);

        assertThat(session.getCounselorId()).isNull();
        assertThat(response.status()).isEqualTo(ConsultationStatus.REJECTED);
        verify(consultationWaitingEventPublisher).publishRejected(session.getConsultationId());
    }

    @Test
    void reject_실패_존재하지_않는_상담() {
        given(consultationSessionRepository.findById("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.reject("cs_notfound", COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void reject_실패_거절_불가능한_상태() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getAccountId()).willReturn(COUNSELOR_ACCOUNT_ID);

        consultationSessionService.reject(session.getConsultationId(), COUNSELOR_ACCOUNT_ID); // WAITING -> REJECTED

        assertThatThrownBy(() -> consultationSessionService.reject(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_REJECTABLE);
    }

    @Test
    void end_성공() {
        ConsultationSession session = newSession();
        session.accept(COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getAccountId()).willReturn(COUNSELOR_ACCOUNT_ID);

        ConsultationEndResponse response =
                consultationSessionService.end(session.getConsultationId(), COUNSELOR_ACCOUNT_ID);

        assertThat(response.status()).isEqualTo(ConsultationStatus.ENDED);
        assertThat(session.getEndedAt()).isNotNull();
        assertThat(session.getSignalingRoomId()).isNull();
        verify(applicationEventPublisher)
                .publishEvent(new ConsultationEndedEvent(
                        session.getConsultationId(),
                        "room_" + session.getConsultationId()
                ));
    }

    @Test
    void end_실패_존재하지_않는_상담() {
        given(consultationSessionRepository.findById("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.end("cs_notfound", COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void end_실패_종료_불가능한_상태() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);

        assertThatThrownBy(() -> consultationSessionService.end(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_ENDABLE);
        verify(applicationEventPublisher, never()).publishEvent(any());
    }

    @Test
    void end_실패_수락한_상담자가_아님() {
        ConsultationSession session = newSession();
        session.accept(OTHER_COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getAccountId()).willReturn(COUNSELOR_ACCOUNT_ID);

        assertThatThrownBy(() -> consultationSessionService.end(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_COUNSELOR_MISMATCH);
        verify(applicationEventPublisher, never()).publishEvent(any());
    }
}
