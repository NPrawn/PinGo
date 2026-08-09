package com.pingo.backend.consultation.service;

import com.pingo.backend.auth.domain.Account;
import com.pingo.backend.auth.domain.AccountType;
import com.pingo.backend.auth.repository.AccountRepository;
import com.pingo.backend.consultation.domain.*;
import com.pingo.backend.consultation.dto.request.ConsultationTranscriptRequest;
import com.pingo.backend.consultation.dto.request.TranscriptSegmentRequest;
import com.pingo.backend.consultation.event.TranscriptSavedEvent;
import com.pingo.backend.consultation.repository.ConsultationSessionRepository;
import com.pingo.backend.consultation.repository.ConsultationSummaryRepository;
import com.pingo.backend.consultation.repository.ConsultationTranscriptRepository;
import com.pingo.backend.global.exception.BusinessException;
import com.pingo.backend.global.exception.ErrorCode;
import com.pingo.backend.usersession.repository.UserSessionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("상담 요약 서비스")
class ConsultationSummaryServiceTest {

    private static final String CONSULTATION_ID = "cs_test1234";
    private static final String USER_SESSION_ID = "usr_test1234";
    private static final Long COUNSELOR_ID = 1L;
    private static final Long STATION_ID = 1L;

    @Mock private ConsultationSessionRepository consultationSessionRepository;
    @Mock private ConsultationSummaryRepository consultationSummaryRepository;
    @Mock private ConsultationTranscriptRepository consultationTranscriptRepository;
    @Mock private AccountRepository accountRepository;
    @Mock private UserSessionRepository userSessionRepository;
    @Mock private ApplicationEventPublisher eventPublisher;

    @InjectMocks private ConsultationSummaryService consultationSummaryService;

    @Mock private ConsultationSession session;
    @Mock private Account counselor;

    @BeforeEach
    void setUp() {
        given(session.getConsultationId()).willReturn(CONSULTATION_ID);
        given(session.getStationId()).willReturn(STATION_ID);
        given(session.getCounselorId()).willReturn(COUNSELOR_ID);
        given(session.getUserSessionId()).willReturn(USER_SESSION_ID);
        given(session.getStatus()).willReturn(ConsultationStatus.ENDED);

        given(counselor.getAccountType()).willReturn(AccountType.COUNSELOR);
        given(counselor.isActive()).willReturn(true);
        given(counselor.getStationId()).willReturn(STATION_ID);
        given(counselor.getName()).willReturn("김상담");

        given(consultationSessionRepository.findByIdForUpdate(CONSULTATION_ID))
                .willReturn(Optional.of(session));
        given(consultationSessionRepository.findById(CONSULTATION_ID))
                .willReturn(Optional.of(session));
        given(accountRepository.findById(COUNSELOR_ID)).willReturn(Optional.of(counselor));
        given(consultationSummaryRepository.findByConsultationId(CONSULTATION_ID))
                .willReturn(Optional.empty());
        given(consultationSummaryRepository.save(any(ConsultationSummary.class)))
                .willAnswer(invocation -> invocation.getArgument(0));
        given(consultationTranscriptRepository.saveAll(any()))
                .willAnswer(invocation -> invocation.getArgument(0));
    }

    private ConsultationTranscriptRequest request(List<TranscriptSegmentRequest> transcript) {
        return new ConsultationTranscriptRequest(
                transcript, "B1 대합실 12번 기둥 부근", null, "3번 출구", "elevator_only");
    }

    private List<TranscriptSegmentRequest> validTranscript() {
        return List.of(
                new TranscriptSegmentRequest(1, TranscriptSpeaker.USER, "여기가 어딘지 모르겠어요."),
                new TranscriptSegmentRequest(2, TranscriptSpeaker.COUNSELOR, "12번 기둥 보이시나요?")
        );
    }

    @Nested
    @DisplayName("전문 저장")
    class SubmitTranscript {

        @Test
        @DisplayName("정상 저장 시 PENDING 상태로 요약을 만들고 이벤트를 발행한다")
        void success() {
            var response = consultationSummaryService.submitTranscript(
                    CONSULTATION_ID, COUNSELOR_ID, request(validTranscript()));

            assertThat(response.status()).isEqualTo(SummaryStatus.PENDING);
            assertThat(response.consultationId()).isEqualTo(CONSULTATION_ID);

            verify(consultationTranscriptRepository).saveAll(any());

            ArgumentCaptor<TranscriptSavedEvent> captor =
                    ArgumentCaptor.forClass(TranscriptSavedEvent.class);
            verify(eventPublisher).publishEvent(captor.capture());
            assertThat(captor.getValue().consultationId()).isEqualTo(CONSULTATION_ID);
        }

        @Test
        @DisplayName("routeType 은 소문자 code 로 저장된다")
        void savesRouteTypeAsCode() {
            consultationSummaryService.submitTranscript(
                    CONSULTATION_ID, COUNSELOR_ID, request(validTranscript()));

            ArgumentCaptor<ConsultationSummary> captor =
                    ArgumentCaptor.forClass(ConsultationSummary.class);
            verify(consultationSummaryRepository).save(captor.capture());
            assertThat(captor.getValue().getRouteType()).isEqualTo("elevator_only");
        }

        @Test
        @DisplayName("지원하지 않는 routeType 이면 UNSUPPORTED_ROUTE_TYPE 예외가 발생한다")
        void unsupportedRouteType() {
            var invalid = new ConsultationTranscriptRequest(
                    validTranscript(), null, null, null, "no_such_route");

            assertThatThrownBy(() -> consultationSummaryService.submitTranscript(
                    CONSULTATION_ID, COUNSELOR_ID, invalid))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.UNSUPPORTED_ROUTE_TYPE);
        }

        @Test
        @DisplayName("종료되지 않은 상담이면 CONSULTATION_NOT_ENDED 예외가 발생한다")
        void notEnded() {
            given(session.getStatus()).willReturn(ConsultationStatus.ACCEPTED);

            assertThatThrownBy(() -> consultationSummaryService.submitTranscript(
                    CONSULTATION_ID, COUNSELOR_ID, request(validTranscript())))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.CONSULTATION_NOT_ENDED);

            verify(eventPublisher, never()).publishEvent(any(TranscriptSavedEvent.class));
        }

        @Test
        @DisplayName("이미 전문이 저장되어 있고 재시도 대상이 아니면 CONSULTATION_SUMMARY_ALREADY_EXISTS 예외가 발생한다")
        void alreadyExists() {
            ConsultationSummary existing =
                    ConsultationSummary.pending(CONSULTATION_ID, null, null, null, null);
            given(consultationSummaryRepository.findByConsultationId(CONSULTATION_ID))
                    .willReturn(Optional.of(existing));

            assertThatThrownBy(() -> consultationSummaryService.submitTranscript(
                    CONSULTATION_ID, COUNSELOR_ID, request(validTranscript())))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode",
                            ErrorCode.CONSULTATION_SUMMARY_ALREADY_EXISTS);

            verify(consultationTranscriptRepository, never()).saveAll(any());
        }

        @Test
        @DisplayName("담당 역이 다른 상담자면 CONSULTATION_STATION_MISMATCH 예외가 발생한다")
        void stationMismatch() {
            given(counselor.getStationId()).willReturn(999L);

            assertThatThrownBy(() -> consultationSummaryService.submitTranscript(
                    CONSULTATION_ID, COUNSELOR_ID, request(validTranscript())))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode",
                            ErrorCode.CONSULTATION_STATION_MISMATCH);
        }

        @Test
        @DisplayName("수락한 상담자가 아니면 CONSULTATION_COUNSELOR_MISMATCH 예외가 발생한다")
        void counselorMismatch() {
            given(session.getCounselorId()).willReturn(2L);

            assertThatThrownBy(() -> consultationSummaryService.submitTranscript(
                    CONSULTATION_ID, COUNSELOR_ID, request(validTranscript())))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode",
                            ErrorCode.CONSULTATION_COUNSELOR_MISMATCH);
        }

        @Test
        @DisplayName("전문이 비어 있으면 EMPTY_TRANSCRIPT 예외가 발생한다")
        void emptyTranscript() {
            assertThatThrownBy(() -> consultationSummaryService.submitTranscript(
                    CONSULTATION_ID, COUNSELOR_ID, request(List.of())))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.EMPTY_TRANSCRIPT);
        }

        @Test
        @DisplayName("seq 가 중복되면 INVALID_REQUEST 예외가 발생한다")
        void duplicatedSeq() {
            var duplicated = List.of(
                    new TranscriptSegmentRequest(1, TranscriptSpeaker.USER, "첫 번째"),
                    new TranscriptSegmentRequest(1, TranscriptSpeaker.COUNSELOR, "중복")
            );

            assertThatThrownBy(() -> consultationSummaryService.submitTranscript(
                    CONSULTATION_ID, COUNSELOR_ID, request(duplicated)))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_REQUEST);
        }
    }

    @Nested
    @DisplayName("요약 조회")
    class FindSummary {

        @Test
        @DisplayName("요약이 없으면 CONSULTATION_SUMMARY_NOT_FOUND 예외가 발생한다")
        void notFound() {
            assertThatThrownBy(() ->
                    consultationSummaryService.find(CONSULTATION_ID, COUNSELOR_ID))
                    .isInstanceOf(BusinessException.class)
                    .hasFieldOrPropertyWithValue("errorCode",
                            ErrorCode.CONSULTATION_SUMMARY_NOT_FOUND);
        }

        @Test
        @DisplayName("상담자 이름과 전문을 함께 반환한다")
        void returnsComposite() {
            var summary = ConsultationSummary.pending(
                    CONSULTATION_ID, "B1 대합실 12번 기둥 부근", null, "3번 출구", "elevator_only");
            summary.complete("12번 기둥에서 엘리베이터로 3번 출구까지 안내 완료");

            given(consultationSummaryRepository.findByConsultationId(CONSULTATION_ID))
                    .willReturn(Optional.of(summary));
            given(consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(CONSULTATION_ID))
                    .willReturn(List.of(
                            ConsultationTranscript.of(
                                    CONSULTATION_ID, 1, TranscriptSpeaker.USER, "여기가 어딘지 모르겠어요.")));

            var response = consultationSummaryService.find(CONSULTATION_ID, COUNSELOR_ID);

            assertThat(response.counselorName()).isEqualTo("김상담");
            assertThat(response.transcript()).hasSize(1);
            assertThat(response.transcript().get(0).content()).isEqualTo("여기가 어딘지 모르겠어요.");
        }
    }
}