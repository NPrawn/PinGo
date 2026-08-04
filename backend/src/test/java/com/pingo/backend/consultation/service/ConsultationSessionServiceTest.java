package com.pingo.backend.consultation.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.domain.CounselorStatus;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.consultation.domain.ConsultationSession;
import com.pingo.backend.consultation.domain.ConsultationStatus;
import com.pingo.backend.consultation.domain.ProblemType;
import com.pingo.backend.consultation.dto.request.ConsultationCreateRequest;
import com.pingo.backend.consultation.dto.request.ConsultationEndRequest;
import com.pingo.backend.consultation.dto.response.*;
import com.pingo.backend.consultation.event.ConsultationAcceptedEvent;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.List;
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
    private static final List<ConsultationStatus> ACTIVE_STATUSES =
            List.of(ConsultationStatus.WAITING, ConsultationStatus.ACCEPTED, ConsultationStatus.IN_PROGRESS);

    private ConsultationCreateRequest createRequest;
    private UserSession userSession;

    @BeforeEach
    void setUp() {
        createRequest = new ConsultationCreateRequest(
                USER_SESSION_ID, STATION_ID, ProblemType.CANNOT_FIND_EXIT,
                15L, "place", 3L, true, true, true
        );
        userSession = mock(UserSession.class);
    }

    private ConsultationSession newSession() {
        return ConsultationSession.create(
                USER_SESSION_ID, STATION_ID, ProblemType.CANNOT_FIND_EXIT,
                15L, "place", 3L, true, true, true
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
                15L, "place", null, true, true, true
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
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        ConsultationCancelResponse response =
                consultationSessionService.cancel(session.getConsultationId(), USER_SESSION_ID);

        assertThat(response.status()).isEqualTo(ConsultationStatus.CANCELED);
    }

    @Test
    void cancel_수락된_상담도_성공하고_상담원은_AVAILABLE이_된다() {
        ConsultationSession session = newSession();
        session.accept(COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));

        ConsultationCancelResponse response =
                consultationSessionService.cancel(session.getConsultationId(), USER_SESSION_ID);

        assertThat(response.status()).isEqualTo(ConsultationStatus.CANCELED);
        verify(counselor).changeStatus(CounselorStatus.AVAILABLE);
    }

    @Test
    void cancel_실패_존재하지_않는_상담() {
        given(consultationSessionRepository.findByIdForUpdate("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.cancel("cs_notfound", USER_SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void cancel_실패_취소_불가능한_상태() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));
        consultationSessionService.cancel(session.getConsultationId(), USER_SESSION_ID); // WAITING -> CANCELED

        assertThatThrownBy(() -> consultationSessionService.cancel(session.getConsultationId(), USER_SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_CANCELABLE);
    }

    @Test
    void cancel_실패_상담_소유자가_아님() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
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
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));
        consultationSessionService.cancel(session.getConsultationId(), USER_SESSION_ID); // 소유자가 먼저 취소 -> CANCELED

        assertThatThrownBy(() -> consultationSessionService.cancel(session.getConsultationId(), OTHER_USER_SESSION_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }
    @Test
    void accept_성공() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getStatus()).willReturn(CounselorStatus.AVAILABLE);
        given(counselor.getAccountId()).willReturn(COUNSELOR_ACCOUNT_ID);
        given(signalingAccessTokenProvider.createCounselorToken(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .willReturn("counselor-signaling-token");

        ConsultationAcceptResponse response =
                consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID);

        assertThat(response.status()).isEqualTo(ConsultationStatus.ACCEPTED);
        assertThat(response.counselorId()).isEqualTo(COUNSELOR_ACCOUNT_ID);
        assertThat(response.signalingRoomId()).isEqualTo("room_" + session.getConsultationId());
        assertThat(response.signalingAccessToken()).isEqualTo("counselor-signaling-token");
        verify(counselor).changeStatus(CounselorStatus.BUSY);
        // 커밋 뒤에 알려야 사용자가 곧바로 조회했을 때 signaling 토큰을 받을 수 있다.
        verify(applicationEventPublisher).publishEvent(
                new ConsultationAcceptedEvent(
                        session.getConsultationId(), "room_" + session.getConsultationId()));
    }

    @Test
    void accept_실패_존재하지_않는_상담() {
        given(consultationSessionRepository.findByIdForUpdate("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.accept("cs_notfound", COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void accept_실패_존재하지_않는_계정() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.ACCOUNT_NOT_FOUND);
    }

    @Test
    void accept_실패_상담자_계정이_아님() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account adminAccount = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(adminAccount));
        given(adminAccount.getAccountType()).willReturn(AccountType.ADMIN);

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.ACCOUNT_NOT_FOUND);
    }

    @Test
    void accept_실패_담당_역이_아님() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
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
        session.accept(COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_ACCEPTABLE);
        verify(accountRepository, never()).findByIdForUpdate(COUNSELOR_ACCOUNT_ID);
        verify(counselor, never()).changeStatus(CounselorStatus.BUSY);
    }

    @Test
    void accept_실패_상담자가_상담_가능_상태가_아님() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getStatus()).willReturn(CounselorStatus.BUSY);

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.COUNSELOR_NOT_AVAILABLE);
        verify(counselor, never()).changeStatus(CounselorStatus.BUSY);
    }

    @Test
    void accept_실패_비활성_계정() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(false);

        assertThatThrownBy(() -> consultationSessionService.accept(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INACTIVE_ACCOUNT);
    }

    @Test
    void reject_성공() {
        ConsultationSession session = newSession();
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
        given(consultationSessionRepository.findByIdForUpdate("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.reject("cs_notfound", COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void reject_실패_거절_불가능한_상태() {
        ConsultationSession session = newSession();
        session.reject();
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);

        assertThatThrownBy(() -> consultationSessionService.reject(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_REJECTABLE);
        verify(accountRepository, never()).findById(COUNSELOR_ACCOUNT_ID);
    }

    @Test
    void getConsultationsForCounselor_성공() {
        ConsultationSession session = newSession();
        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        // status를 지정하지 않으면 전체 상태를 조회한다. 요청 목록과 상담 이력이 같은
        // 엔드포인트를 쓰고, 화면에서 필요한 상태만 걸러 보여준다.
        given(consultationSessionRepository
                .findByStationIdAndStatusIn(STATION_ID, List.of(ConsultationStatus.values())))
                .willReturn(List.of(session));

        List<ConsultationListResponse> responses =
                consultationSessionService.getConsultationsForCounselor(COUNSELOR_ACCOUNT_ID, null);

        assertThat(responses).hasSize(1);
        assertThat(responses.get(0).consultationId()).isEqualTo(session.getConsultationId());
    }

    @Test
    void getConsultationsForCounselor_상태_필터_적용() {
        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(consultationSessionRepository.findByStationIdAndStatusIn(STATION_ID, List.of(ConsultationStatus.WAITING)))
                .willReturn(List.of());

        consultationSessionService.getConsultationsForCounselor(COUNSELOR_ACCOUNT_ID, ConsultationStatus.WAITING);

        verify(consultationSessionRepository).findByStationIdAndStatusIn(STATION_ID, List.of(ConsultationStatus.WAITING));
    }

    @Test
    void getConsultationsForCounselor_실패_인증되지_않음() {
        assertThatThrownBy(() -> consultationSessionService.getConsultationsForCounselor(null, null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.UNAUTHENTICATED);
    }

    @Test
    void getConsultationsForCounselor_실패_존재하지_않는_계정() {
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.getConsultationsForCounselor(COUNSELOR_ACCOUNT_ID, null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.ACCOUNT_NOT_FOUND);
    }

    @Test
    void getConsultationsForCounselor_실패_비활성_계정() {
        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(false);

        assertThatThrownBy(() -> consultationSessionService.getConsultationsForCounselor(COUNSELOR_ACCOUNT_ID, null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INACTIVE_ACCOUNT);
    }
    @Test
    void getConsultationDetailForCounselor_성공() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);

        ConsultationDetailResponse response =
                consultationSessionService.getConsultationDetailForCounselor(session.getConsultationId(), COUNSELOR_ACCOUNT_ID);

        assertThat(response.consultationId()).isEqualTo(session.getConsultationId());
        assertThat(response.locationConsent()).isTrue(); // ← 추가 검증
        assertThat(response.signalingRoomId()).isNull();
        assertThat(response.signalingAccessToken()).isNull();
    }

    @Test
    void getConsultationDetailForCounselor_성공_수락된_상담이면_상담원_signaling_token을_반환한다() {
        ConsultationSession session = newSession();
        session.accept(COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(signalingAccessTokenProvider.createCounselorToken(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .willReturn("counselor-signaling-token");

        ConsultationDetailResponse response =
                consultationSessionService.getConsultationDetailForCounselor(session.getConsultationId(), COUNSELOR_ACCOUNT_ID);

        assertThat(response.signalingRoomId()).isEqualTo("room_" + session.getConsultationId());
        assertThat(response.signalingAccessToken()).isEqualTo("counselor-signaling-token");
    }

    @Test
    void getConsultationDetailForCounselor_배정된_상담자가_아니면_토큰없이_반환한다() {
        ConsultationSession session = newSession();
        session.accept(OTHER_COUNSELOR_ACCOUNT_ID); // 배정된 상담자는 내가 아님
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);

        ConsultationDetailResponse response =
                consultationSessionService.getConsultationDetailForCounselor(session.getConsultationId(), COUNSELOR_ACCOUNT_ID);

        assertThat(response.status()).isEqualTo(ConsultationStatus.ACCEPTED);
        assertThat(response.signalingRoomId()).isEqualTo("room_" + session.getConsultationId());
        assertThat(response.signalingAccessToken()).isNull();
        verify(signalingAccessTokenProvider, never()).createCounselorToken(any(), any());
    }

    @Test
    void getConsultationDetailForCounselor_실패_존재하지_않는_상담() {
        given(consultationSessionRepository.findById("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.getConsultationDetailForCounselor("cs_notfound", COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void getConsultationDetailForCounselor_실패_담당_역이_아님() {
        ConsultationSession session = newSession();
        given(consultationSessionRepository.findById(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findById(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(OTHER_STATION_ID);

        assertThatThrownBy(() -> consultationSessionService.getConsultationDetailForCounselor(session.getConsultationId(), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_STATION_MISMATCH);
    }

    @Test
    void end_성공_상담자() {
        ConsultationSession session = newSession();
        session.accept(COUNSELOR_ACCOUNT_ID); // WAITING -> ACCEPTED
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getAccountId()).willReturn(COUNSELOR_ACCOUNT_ID);

        ConsultationEndResponse response = consultationSessionService.end(
                session.getConsultationId(), new ConsultationEndRequest("counselor", null), COUNSELOR_ACCOUNT_ID);

        assertThat(response.status()).isEqualTo(ConsultationStatus.ENDED);
        assertThat(session.getEndedAt()).isNotNull();
        verify(counselor).changeStatus(CounselorStatus.AVAILABLE);
        verify(applicationEventPublisher)
                .publishEvent(new ConsultationEndedEvent(
                        session.getConsultationId(),
                        "room_" + session.getConsultationId()
                ));
    }

    @Test
    void end_성공_사용자() {
        ConsultationSession session = newSession();
        session.accept(COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));

        ConsultationEndResponse response = consultationSessionService.end(
                session.getConsultationId(), new ConsultationEndRequest("user", USER_SESSION_ID), null);

        assertThat(response.status()).isEqualTo(ConsultationStatus.ENDED);
        verify(counselor).changeStatus(CounselorStatus.AVAILABLE);
    }

    @Test
    void end_실패_사용자_종료인데_userSessionId_누락() {
        assertThatThrownBy(() -> consultationSessionService.end(
                "cs_dummy", new ConsultationEndRequest("user", null), null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_REQUEST);

        verify(consultationSessionRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void end_실패_존재하지_않는_상담() {
        given(consultationSessionRepository.findByIdForUpdate("cs_notfound")).willReturn(Optional.empty());

        assertThatThrownBy(() -> consultationSessionService.end(
                "cs_notfound", new ConsultationEndRequest("user", USER_SESSION_ID), null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void end_실패_종료_불가능한_상태() {
        ConsultationSession session = newSession(); // WAITING
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        assertThatThrownBy(() -> consultationSessionService.end(
                session.getConsultationId(), new ConsultationEndRequest("user", USER_SESSION_ID), null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_ENDABLE);
        verify(accountRepository, never()).findByIdForUpdate(any());
        verify(applicationEventPublisher, never()).publishEvent(any());
    }

    @Test
    void end_실패_상담자_담당_역이_아님() {
        ConsultationSession session = newSession();
        session.accept(COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(OTHER_STATION_ID);

        assertThatThrownBy(() -> consultationSessionService.end(
                session.getConsultationId(), new ConsultationEndRequest("counselor", null), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_STATION_MISMATCH);
    }

    @Test
    void end_실패_사용자_소유자가_아님() {
        ConsultationSession session = newSession();
        session.accept(COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        assertThatThrownBy(() -> consultationSessionService.end(
                session.getConsultationId(), new ConsultationEndRequest("user", OTHER_USER_SESSION_ID), null))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_NOT_FOUND);
    }

    @Test
    void end_실패_수락한_상담자가_아님() {
        ConsultationSession session = newSession();
        session.accept(OTHER_COUNSELOR_ACCOUNT_ID);
        given(consultationSessionRepository.findByIdForUpdate(session.getConsultationId()))
                .willReturn(Optional.of(session));

        Account counselor = mock(Account.class);
        given(accountRepository.findByIdForUpdate(COUNSELOR_ACCOUNT_ID)).willReturn(Optional.of(counselor));
        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getAccountId()).willReturn(COUNSELOR_ACCOUNT_ID);

        assertThatThrownBy(() -> consultationSessionService.end(
                session.getConsultationId(), new ConsultationEndRequest("counselor", null), COUNSELOR_ACCOUNT_ID))
                .isInstanceOf(BusinessException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CONSULTATION_COUNSELOR_MISMATCH);
        verify(counselor, never()).changeStatus(CounselorStatus.AVAILABLE);
        verify(applicationEventPublisher, never()).publishEvent(any());
    }

}
