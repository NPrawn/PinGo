package com.pingo.backend.consultation.service;

import com.pingo.backend.consultation.domain.ConsultationTranscript;
import com.pingo.backend.consultation.domain.TranscriptSpeaker;
import com.pingo.backend.consultation.event.TranscriptSavedEvent;
import com.pingo.backend.consultation.repository.ConsultationTranscriptRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@DisplayName("상담 요약 비동기 처리기")
class ConsultationSummaryProcessorTest {

    private static final String CONSULTATION_ID = "cs_test1234";

    @Mock private ConsultationTranscriptRepository consultationTranscriptRepository;
    @Mock private ConsultationSummaryGenerator summaryGenerator;
    @Mock private ConsultationSummaryUpdater summaryUpdater;

    @InjectMocks private ConsultationSummaryProcessor processor;

    private List<ConsultationTranscript> transcripts() {
        return List.of(ConsultationTranscript.of(
                CONSULTATION_ID, 1, TranscriptSpeaker.USER, "여기가 어딘지 모르겠어요."));
    }

    @Test
    @DisplayName("생성에 성공하면 요약을 COMPLETED 로 반영한다")
    void completed() {
        given(consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(CONSULTATION_ID))
                .willReturn(transcripts());
        given(summaryGenerator.generate(any())).willReturn("3번 출구까지 안내 완료");

        processor.handle(new TranscriptSavedEvent(CONSULTATION_ID));

        verify(summaryUpdater).complete(CONSULTATION_ID, "3번 출구까지 안내 완료");
        verify(summaryUpdater, never()).fail(CONSULTATION_ID);
    }

    @Test
    @DisplayName("생성 중 예외가 나면 FAILED 로 반영하고 예외를 밖으로 던지지 않는다")
    void failed() {
        given(consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(CONSULTATION_ID))
                .willReturn(transcripts());
        willThrow(new IllegalStateException("요약 API 오류"))
                .given(summaryGenerator).generate(any());

        processor.handle(new TranscriptSavedEvent(CONSULTATION_ID));

        verify(summaryUpdater).fail(CONSULTATION_ID);
        verify(summaryUpdater, never()).complete(any(), any());
    }

    @Test
    @DisplayName("전문이 없으면 생성기를 호출하지 않고 FAILED 로 반영한다")
    void emptyTranscript() {
        given(consultationTranscriptRepository.findByConsultationIdOrderBySeqAsc(CONSULTATION_ID))
                .willReturn(List.of());

        processor.handle(new TranscriptSavedEvent(CONSULTATION_ID));

        verify(summaryGenerator, never()).generate(any());
        verify(summaryUpdater).fail(CONSULTATION_ID);
    }
}