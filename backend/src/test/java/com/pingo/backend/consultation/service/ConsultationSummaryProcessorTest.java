package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationSummary;
import com.pingo.backend.consultation.domain.ConsultationTranscript;
import com.pingo.backend.consultation.domain.SummaryStatus;
import com.pingo.backend.consultation.domain.TranscriptSpeaker;
import com.pingo.backend.consultation.event.TranscriptSavedEvent;
import com.pingo.backend.consultation.repository.ConsultationSummaryRepository;
import com.pingo.backend.consultation.repository.ConsultationTranscriptRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;

@ExtendWith(MockitoExtension.class)
@DisplayName("상담 요약 비동기 처리기")
class ConsultationSummaryProcessorTest {

    private static final String CONSULTATION_ID = "cs_test1234";

    @Mock private ConsultationSummaryRepository consultationSummaryRepository;
    @Mock private ConsultationTranscriptRepository consultationTranscriptRepository;
    @Mock private ConsultationSummaryGenerator summaryGenerator;

    @InjectMocks private ConsultationSummaryProcessor processor;

    private ConsultationSummary summary;

    @BeforeEach
    void setUp() {
        summary = ConsultationSummary.pending(CONSULTATION_ID, null, null, null, null);
        given(consultationSummaryRepository.findByConsultationId(CONSULTATION_ID))
                .willReturn(Optional.of(summary));
    }

    @Test
    @DisplayName("생성에 성공하면 COMPLETED 로 전환된다")
    void completed() {
        given(consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(CONSULTATION_ID))
                .willReturn(List.of(ConsultationTranscript.of(
                        CONSULTATION_ID, 1, TranscriptSpeaker.USER, "여기가 어딘지 모르겠어요.")));
        given(summaryGenerator.generate(any())).willReturn("3번 출구까지 안내 완료");

        processor.handle(new TranscriptSavedEvent(CONSULTATION_ID));

        assertThat(summary.getStatus()).isEqualTo(SummaryStatus.COMPLETED);
        assertThat(summary.getSummaryText()).isEqualTo("3번 출구까지 안내 완료");
        assertThat(summary.getCompletedAt()).isNotNull();
    }

    @Test
    @DisplayName("생성 중 예외가 나면 FAILED 로 전환되고 예외를 밖으로 던지지 않는다")
    void failed() {
        given(consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(CONSULTATION_ID))
                .willReturn(List.of(ConsultationTranscript.of(
                        CONSULTATION_ID, 1, TranscriptSpeaker.USER, "여기가 어딘지 모르겠어요.")));
        willThrow(new IllegalStateException("요약 API 오류"))
                .given(summaryGenerator).generate(any());

        processor.handle(new TranscriptSavedEvent(CONSULTATION_ID));

        assertThat(summary.getStatus()).isEqualTo(SummaryStatus.FAILED);
        assertThat(summary.getSummaryText()).isNull();
    }

    @Test
    @DisplayName("전문이 없으면 생성기를 호출하지 않고 FAILED 로 전환된다")
    void emptyTranscript() {
        given(consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(CONSULTATION_ID))
                .willReturn(List.of());

        processor.handle(new TranscriptSavedEvent(CONSULTATION_ID));

        assertThat(summary.getStatus()).isEqualTo(SummaryStatus.FAILED);
    }
}